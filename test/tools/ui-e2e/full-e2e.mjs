const BASE_URL = 'http://localhost:8080';
const WS_URL = 'ws://localhost:8080/ws';

class Session {
  constructor(name) {
    this.name = name;
    this.cookies = new Map();
  }

  cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  #storeCookies(response) {
    const setCookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];

    if (setCookies.length === 0) {
      const single = response.headers.get('set-cookie');
      if (!single) {
        return;
      }
      const split = single.split(/,(?=\s*[^;=,\s]+=[^;=,\s]+)/g);
      for (const raw of split) {
        const [pair] = raw.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) {
          this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
        }
      }
      return;
    }

    for (const raw of setCookies) {
      const [pair] = raw.split(';');
      const idx = pair.indexOf('=');
      if (idx > 0) {
        this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
      }
    }
  }

  async request(path, options = {}) {
    const {
      method = 'GET',
      body = undefined,
      contentType = null,
      expected = null
    } = options;

    const headers = {};
    const cookie = this.cookieHeader();
    if (cookie) {
      headers.Cookie = cookie;
    }
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body,
      redirect: 'follow'
    });

    this.#storeCookies(response);

    const contentTypeResp = (response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();

    let payload = null;
    if (text) {
      if (contentTypeResp.includes('application/json')) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      } else {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      }
    }

    if (expected != null) {
      const expectedList = Array.isArray(expected) ? expected : [expected];
      if (!expectedList.includes(response.status)) {
        throw new Error(`[${this.name}] ${method} ${path} -> ${response.status}, expected ${expectedList.join('/')}. Body: ${text}`);
      }
    }

    return {
      status: response.status,
      payload,
      text,
      headers: response.headers
    };
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeUuidLike(payload) {
  if (!payload) {
    return null;
  }
  if (typeof payload === 'string') {
    return payload.replace(/^"|"$/g, '').trim();
  }
  if (typeof payload === 'object') {
    if (typeof payload.id === 'string') return payload.id;
    if (typeof payload.userId === 'string') return payload.userId;
    if (typeof payload.value === 'string') return payload.value;
  }
  return null;
}

async function registerUser(alias) {
  const session = new Session(alias);
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const username = `e2e_${alias}_${suffix}`;
  const password = 'P@ssword12345';

  await session.request('/auth/reg', {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ username, password }),
    expected: 200
  });

  const idRes = await session.request('/api/getId', { expected: 200 });
  const userId = normalizeUuidLike(idRes.payload);
  assert(userId, `[${alias}] /api/getId did not return userId`);

  const chatPage = await session.request('/chat.html', { expected: 200 });
  assert(String(chatPage.text || '').includes('js/chat/app.js'), `[${alias}] chat.html does not load modular app`);

  await session.request('/js/chat/app.js', { expected: 200 });

  return { session, username, password, userId };
}

function makeStompClient(cookieHeader) {
  const ws = new WebSocket(WS_URL, {
    headers: cookieHeader ? { Cookie: cookieHeader } : {}
  });

  let buffer = '';
  const listeners = [];
  let connected = false;

  function sendFrame(command, headers = {}, body = '') {
    const lines = [command];
    for (const [key, value] of Object.entries(headers)) {
      lines.push(`${key}:${value}`);
    }
    lines.push('');
    lines.push(body);
    ws.send(`${lines.join('\n')}\0`);
  }

  function onFrame(handler) {
    listeners.push(handler);
  }

  function parseChunk(chunk) {
    buffer += chunk;
    const frames = buffer.split('\0');
    buffer = frames.pop() || '';
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
      for (const handler of listeners) {
        handler({ command, headers, body });
      }
    }
  }

  ws.onopen = () => {
    sendFrame('CONNECT', {
      'accept-version': '1.2,1.1',
      'heart-beat': '10000,10000'
    });
  };

  ws.onmessage = (event) => {
    parseChunk(String(event.data || ''));
  };

  return {
    ws,
    onFrame,
    sendFrame,
    waitConnected: (timeoutMs = 10000) => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket STOMP connect timeout')), timeoutMs);
      onFrame((frame) => {
        if (frame.command === 'CONNECTED' && !connected) {
          connected = true;
          clearTimeout(timeout);
          resolve();
        }
        if (frame.command === 'ERROR') {
          clearTimeout(timeout);
          reject(new Error(`WebSocket STOMP error: ${frame.body || JSON.stringify(frame.headers)}`));
        }
      });
      ws.onerror = (e) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${e?.message || 'unknown'}`));
      };
    }),
    subscribe: (id, destination) => sendFrame('SUBSCRIBE', { id, destination }, ''),
    close: () => {
      try { ws.close(); } catch {}
    }
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('STEP 1/9: register two users and open chat UI');
  const userA = await registerUser('a');
  const userB = await registerUser('b');
  console.log(`  userA=${userA.username} (${userA.userId})`);
  console.log(`  userB=${userB.username} (${userB.userId})`);

  console.log('STEP 2/9: initial key endpoints');
  const initialKeyA = await userA.session.request('/api/encrypt_key/', { expected: [200, 404] });
  const initialKeyB = await userB.session.request('/api/encrypt_key/', { expected: [200, 404] });
  const initialPrivateA = await userA.session.request('/api/encrypt_key/new_private_key', { expected: [200, 204, 404] });
  const initialPrivateB = await userB.session.request('/api/encrypt_key/new_private_key', { expected: [200, 204, 404] });
  console.log(`  keyA=${initialKeyA.status}, keyB=${initialKeyB.status}, newPrivateA=${initialPrivateA.status}, newPrivateB=${initialPrivateB.status}`);

  console.log('STEP 3/9: save and read public keys');
  const pubA = Buffer.from(`public-key-${userA.username}`).toString('base64');
  const pubB = Buffer.from(`public-key-${userB.username}`).toString('base64');
  await userA.session.request('/api/encrypt_key/new_key', {
    method: 'POST',
    contentType: 'text/plain',
    body: pubA,
    expected: [200, 409]
  });
  await userB.session.request('/api/encrypt_key/new_key', {
    method: 'POST',
    contentType: 'text/plain',
    body: pubB,
    expected: [200, 409]
  });

  const keyA = await userA.session.request('/api/encrypt_key/', { expected: 200 });
  const keyB = await userB.session.request('/api/encrypt_key/', { expected: 200 });
  assert(keyA.payload?.id && keyA.payload?.userId, 'userA public key not returned after save');
  assert(keyB.payload?.id && keyB.payload?.userId, 'userB public key not returned after save');

  console.log('STEP 4/9: search user and create personal chat');
  const search = await userA.session.request(`/api/search_by_username?username=${encodeURIComponent(userB.username)}`, { expected: 200 });
  assert(Array.isArray(search.payload), 'search_by_username did not return array');
  const createChat = await userA.session.request('/api/personal_chat', {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ userId: userB.userId }),
    expected: 200
  });
  const chatId = Number(createChat.payload?.chatId);
  assert(Number.isFinite(chatId) && chatId > 0, 'personal_chat did not return chatId');
  console.log(`  created chatId=${chatId}`);

  const chatsA = await userA.session.request('/api/chats', { expected: 200 });
  const chatsB = await userB.session.request('/api/chats', { expected: 200 });
  assert(Array.isArray(chatsA.payload), 'userA chats is not array');
  assert(Array.isArray(chatsB.payload), 'userB chats is not array');

  const members = await userA.session.request(`/api/chats/${chatId}/members`, { expected: 200 });
  assert(Array.isArray(members.payload), 'chat members is not array');
  assert(members.payload.includes(userA.userId) && members.payload.includes(userB.userId), 'chat members do not contain both users');

  console.log('STEP 5/9: connect websocket and subscribe');
  const wsEvents = [];
  const stomp = makeStompClient(userB.session.cookieHeader());
  stomp.onFrame((frame) => {
    if (frame.command === 'MESSAGE') {
      wsEvents.push(frame);
    }
  });
  await stomp.waitConnected(10000);
  stomp.subscribe('sub-user', '/user/queue/events');
  stomp.subscribe(`sub-chat-${chatId}`, `/topic/chat/${chatId}`);
  await sleep(300);
  console.log('  websocket connected and subscribed');

  console.log('STEP 6/9: send message keys');
  const keyList = await userA.session.request('/api/encrypt_key/byUserIdIn', {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify([userA.userId, userB.userId]),
    expected: 200
  });
  assert(Array.isArray(keyList.payload) && keyList.payload.length >= 2, 'byUserIdIn did not return public keys for both users');

  const senderKeyB64 = Buffer.from(`sender-key-${Date.now()}`).toString('base64');
  const rows = keyList.payload.map((k) => ({
    userTarget: k.userId,
    key: senderKeyB64,
    publicKeyUser: k.id
  }));

  const sendKeysRes = await userA.session.request('/api/encrypt_message_key/send', {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({
      chatId,
      requestEncryptMessageKeyForUsers: rows
    }),
    expected: 200
  });
  const encryptName = sendKeysRes.payload?.encryptName;
  assert(encryptName, 'encrypt_message_key/send did not return encryptName');
  console.log(`  encryptName=${encryptName}`);

  const pendingB = await userB.session.request('/api/encrypt_message_key/pending', { expected: 200 });
  assert(Array.isArray(pendingB.payload), 'pending keys for userB is not array');
  assert(pendingB.payload.length > 0, 'pending keys for userB is empty after send');

  console.log('STEP 7/9: send and read message');
  const messageText = `hello-e2e-${Date.now()}`;
  const messageB64 = Buffer.from(messageText, 'utf-8').toString('base64');
  const sendMessageRes = await userA.session.request('/api/sendMessage', {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({
      chatId,
      message: messageB64,
      encryptionName: String(encryptName)
    }),
    expected: 200
  });
  assert(sendMessageRes.payload?.messageId, 'sendMessage did not return messageId');

  const messagesB = await userB.session.request(`/api/messages/${chatId}?limit=50`, { expected: 200 });
  assert(Array.isArray(messagesB.payload), 'messages list is not array');
  const found = messagesB.payload.some((m) => Number(m.messageId) === Number(sendMessageRes.payload.messageId));
  assert(found, 'sent message is not visible in recipient history');

  console.log('STEP 8/9: check key usage endpoint');
  const usage = await userA.session.request(`/api/key-usage/chats/${chatId}/latest`, { expected: 200 });
  assert(usage.payload && Number(usage.payload.count) >= 1, 'key usage count was not incremented');
  assert(String(usage.payload.encryptionName) === String(encryptName), 'key usage encryptionName mismatch');

  console.log('STEP 9/9: validate websocket events');
  const wsDeadline = Date.now() + 35000;
  while (wsEvents.length === 0 && Date.now() < wsDeadline) {
    await sleep(500);
  }
  stomp.close();
  assert(wsEvents.length > 0, 'no websocket MESSAGE frames received after key/message send (waited 35s)');
  console.log(`  websocket messages received=${wsEvents.length}`);

  console.log('\nE2E RESULT: OK');
  console.log(`chatId=${chatId}, messageId=${sendMessageRes.payload.messageId}, encryptName=${encryptName}`);
}

run().catch((error) => {
  console.error('\nE2E RESULT: FAILED');
  console.error(error?.stack || String(error));
  process.exit(1);
});
