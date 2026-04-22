import { WS } from './constants.js';

export class WsManager {
  constructor({ ui, onMessage }) {
    this.ui = ui;
    this.onMessage = onMessage;
    this.ws = null;
    this.connected = false;
    this.buffer = '';
    this.chatSubscriptions = new Set();
  }

  connect(chatIds = []) {
    this.disconnect();
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${protocol}://${window.location.host}${WS.endpoint}`);

    this.ws.onopen = () => {
      this.#sendFrame('CONNECT', {
        'accept-version': '1.2,1.1',
        'heart-beat': '10000,10000'
      }, '');
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.ui.setWsOnline(false);
    };

    this.ws.onerror = () => {
      this.connected = false;
      this.ui.setWsOnline(false);
    };

    this.ws.onmessage = (event) => this.#readChunk(String(event.data || ''), chatIds);
  }

  disconnect() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }
    this.connected = false;
    this.chatSubscriptions.clear();
  }

  syncChats(chatIds) {
    if (!this.connected) {
      return;
    }

    const nextSet = new Set((chatIds || []).map((id) => Number(id)));
    for (const oldChatId of Array.from(this.chatSubscriptions)) {
      if (!nextSet.has(oldChatId)) {
        this.#unsubscribeChat(oldChatId);
      }
    }
    for (const chatId of nextSet) {
      if (!this.chatSubscriptions.has(chatId)) {
        this.#subscribeChat(chatId);
      }
    }
  }

  requestMessageKey({ chatId, messageId, senderId, encryptName }) {
    if (!this.connected || !chatId || !senderId || !encryptName) {
      return false;
    }

    this.#sendFrame('SEND', {
      destination: '/app/message-key.request',
      'content-type': 'application/json'
    }, JSON.stringify({
      chatId,
      messageId: messageId || null,
      senderId,
      encryptName
    }));
    return true;
  }

  #readChunk(chunk, chatIds) {
    this.buffer += chunk;
    const frames = this.buffer.split('\0');
    this.buffer = frames.pop() || '';

    for (const raw of frames) {
      const frame = raw.replace(/^\n+/, '');
      if (!frame) continue;
      const lines = frame.split('\n');
      const command = lines[0] || '';
      const headers = {};
      let bodyStart = -1;
      for (let i = 1; i < lines.length; i += 1) {
        if (lines[i] === '') {
          bodyStart = i + 1;
          break;
        }
        const idx = lines[i].indexOf(':');
        if (idx > 0) {
          headers[lines[i].slice(0, idx)] = lines[i].slice(idx + 1);
        }
      }
      const body = bodyStart >= 0 ? lines.slice(bodyStart).join('\n') : '';
      this.#handleFrame(command, headers, body, chatIds);
    }
  }

  #handleFrame(command, headers, body, chatIds) {
    if (command === 'CONNECTED') {
      this.connected = true;
      this.ui.setWsOnline(true);
      this.#sendFrame('SUBSCRIBE', { id: 'sub-user-events', destination: WS.userDestination }, '');
      this.syncChats(chatIds);
      return;
    }

    if (command === 'MESSAGE') {
      this.onMessage(body, headers);
      return;
    }

    if (command === 'ERROR') {
      this.ui.appendStatus(`WS \u043e\u0448\u0438\u0431\u043a\u0430: ${body || 'protocol error'}`, 'error');
    }
  }

  #subscribeChat(chatId) {
    const destination = `${WS.chatPrefix}${chatId}`;
    this.#sendFrame('SUBSCRIBE', { id: `sub-chat-${chatId}`, destination }, '');
    this.chatSubscriptions.add(chatId);
  }

  #unsubscribeChat(chatId) {
    this.#sendFrame('UNSUBSCRIBE', { id: `sub-chat-${chatId}` }, '');
    this.chatSubscriptions.delete(chatId);
  }

  #sendFrame(command, headers, body) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const lines = [command];
    for (const [key, value] of Object.entries(headers || {})) {
      lines.push(`${key}:${value}`);
    }
    lines.push('');
    lines.push(body || '');
    this.ws.send(`${lines.join('\n')}\0`);
  }
}
