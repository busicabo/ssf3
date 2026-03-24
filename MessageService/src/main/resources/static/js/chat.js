(() => {
  const state = {
    currentUserId: null,
    chats: [],
    messagesByChat: new Map(),
    activeChatId: null,
    activeChat: null,
    stompClient: null,
    subscriptions: [],
  };

  const els = {
    currentUser: document.getElementById('current-user'),
    refreshBtn: document.getElementById('refresh-btn'),
    userSearch: document.getElementById('user-search'),
    searchBtn: document.getElementById('search-btn'),
    searchResults: document.getElementById('search-results'),
    chatCount: document.getElementById('chat-count'),
    chatList: document.getElementById('chat-list'),
    chatTitle: document.getElementById('chat-title'),
    chatSubtitle: document.getElementById('chat-subtitle'),
    connectionState: document.getElementById('connection-state'),
    messageList: document.getElementById('message-list'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    composerWarning: document.getElementById('composer-warning'),
    chatItemTemplate: document.getElementById('chat-item-template'),
    userResultTemplate: document.getElementById('user-result-template'),
    messageTemplate: document.getElementById('message-template'),
  };

  const api = {
    async getCurrentUserId() { return fetchJson('/getId'); },
    async getChats() { return fetchJson('/message/api/chats'); },
    async getLastMessages(limit = 100) { return fetchJson(`/message/api/getLastMessages/${limit}`); },
    async searchUsers(username) { return fetchJson(`/message/api/search_by_username?username=${encodeURIComponent(username)}`); },
  };

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'include',
      headers: { 'Accept': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `HTTP ${response.status}`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return response.text();
    return response.json();
  }

  function bytesToText(value) {
    if (value == null) return '';
    if (typeof value === 'string') {
      try {
        return decodeURIComponent(escape(atob(value)));
      } catch {
        return value;
      }
    }
    if (Array.isArray(value)) {
      try { return new TextDecoder().decode(new Uint8Array(value)); } catch { return value.join(','); }
    }
    return String(value);
  }

  function textToBase64(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  function normalizeChat(chat) {
    return {
      ...chat,
      id: chat.id || chat.chatId,
      title: chat.chatName || chat.name || `Chat ${String(chat.id || chat.chatId || '').slice(0, 8)}`,
      preview: bytesToText(chat.lastMessage),
      updatedAt: chat.updatedAt || chat.time || null,
    };
  }

  function normalizeMessage(message) {
    const chatId = message.chatId || message.idChat || message.chat?.id;
    const senderId = message.senderId || message.userId || message.sender?.id || null;
    return {
      ...message,
      chatId,
      senderId,
      text: bytesToText(message.message),
      time: message.createdAt || message.sendTime || message.time || null,
    };
  }

  function setConnection(online) {
    els.connectionState.textContent = online ? 'online' : 'offline';
    els.connectionState.classList.toggle('online', online);
    els.connectionState.classList.toggle('offline', !online);
  }

  function showWarning(text) {
    if (!text) {
      els.composerWarning.textContent = '';
      els.composerWarning.classList.add('hidden');
      return;
    }
    els.composerWarning.textContent = text;
    els.composerWarning.classList.remove('hidden');
  }

  function renderChats() {
    els.chatList.innerHTML = '';
    els.chatCount.textContent = String(state.chats.length);
    if (!state.chats.length) {
      els.chatList.classList.add('empty');
      els.chatList.textContent = 'Чаты не найдены';
      return;
    }
    els.chatList.classList.remove('empty');
    const fragment = document.createDocumentFragment();
    state.chats.forEach((chat) => {
      const node = els.chatItemTemplate.content.firstElementChild.cloneNode(true);
      node.dataset.chatId = chat.id;
      node.classList.toggle('active', chat.id === state.activeChatId);
      node.querySelector('.chat-item-title').textContent = chat.title;
      node.querySelector('.chat-item-preview').textContent = chat.preview || 'Нет сообщений';
      node.querySelector('.chat-item-time').textContent = formatTime(chat.updatedAt);
      node.addEventListener('click', () => openChat(chat.id));
      fragment.appendChild(node);
    });
    els.chatList.appendChild(fragment);
  }

  function renderMessages() {
    const messages = state.messagesByChat.get(state.activeChatId) || [];
    els.messageList.innerHTML = '';
    if (!state.activeChatId) {
      els.messageList.className = 'message-list empty-state';
      els.messageList.innerHTML = '<div class="empty-hint"><h3>Добро пожаловать</h3><p>Выбери чат слева или найди пользователя.</p></div>';
      return;
    }
    els.messageList.className = 'message-list';
    if (!messages.length) {
      els.messageList.innerHTML = '<div class="empty-hint"><h3>Пока пусто</h3><p>Отправь первое сообщение в этот чат.</p></div>';
      return;
    }
    const fragment = document.createDocumentFragment();
    messages.forEach((message) => {
      const node = els.messageTemplate.content.firstElementChild.cloneNode(true);
      const own = state.currentUserId && message.senderId && String(message.senderId) === String(state.currentUserId);
      node.classList.toggle('own', own);
      node.querySelector('.message-text').textContent = message.text || '[пустое сообщение]';
      node.querySelector('.message-meta').textContent = [own ? 'Вы' : 'Собеседник', formatTime(message.time)].filter(Boolean).join(' • ');
      fragment.appendChild(node);
    });
    els.messageList.appendChild(fragment);
    els.messageList.scrollTop = els.messageList.scrollHeight;
  }

  function renderSearchResults(results = [], query = '') {
    els.searchResults.innerHTML = '';
    if (!query.trim()) {
      els.searchResults.classList.add('empty');
      els.searchResults.textContent = 'Введите имя пользователя для поиска';
      return;
    }
    if (!results.length) {
      els.searchResults.classList.add('empty');
      els.searchResults.textContent = 'Ничего не найдено';
      return;
    }
    els.searchResults.classList.remove('empty');
    const fragment = document.createDocumentFragment();
    results.forEach((user) => {
      const node = els.userResultTemplate.content.firstElementChild.cloneNode(true);
      node.querySelector('.user-result-title').textContent = user.chatName || user.username || 'Пользователь';
      node.querySelector('.user-result-subtitle').textContent = user.id || user.chatId || 'Нет chatId';
      node.querySelector('button').addEventListener('click', () => {
        const id = user.id || user.chatId;
        const existing = state.chats.find((chat) => String(chat.id) === String(id));
        if (existing) {
          openChat(existing.id);
        } else {
          showWarning('Backend пока не даёт публичного endpoint для создания нового чата из UI. Нужен отдельный controller/service endpoint.');
        }
      });
      fragment.appendChild(node);
    });
    els.searchResults.appendChild(fragment);
  }

  function openChat(chatId) {
    state.activeChatId = chatId;
    state.activeChat = state.chats.find((chat) => String(chat.id) === String(chatId)) || null;
    els.chatTitle.textContent = state.activeChat?.title || 'Чат';
    els.chatSubtitle.textContent = state.activeChat?.preview || 'Сообщения чата';
    els.messageInput.disabled = false;
    els.sendBtn.disabled = false;
    renderChats();
    renderMessages();
    showWarning('');
    subscribeToChat(chatId);
  }

  function upsertMessage(message) {
    const normalized = normalizeMessage(message);
    if (!normalized.chatId) return;
    const list = state.messagesByChat.get(normalized.chatId) || [];
    list.push(normalized);
    state.messagesByChat.set(normalized.chatId, list);
    const chat = state.chats.find((item) => String(item.id) === String(normalized.chatId));
    if (chat) chat.preview = normalized.text;
    renderChats();
    if (String(state.activeChatId) === String(normalized.chatId)) renderMessages();
  }

  function connectWebSocket() {
    if (!window.SockJS || !window.Stomp) return;
    const socket = new SockJS('/ws');
    state.stompClient = Stomp.over(socket);
    state.stompClient.debug = () => {};
    state.stompClient.connect({}, () => {
      setConnection(true);
      subscribeSystem();
      if (state.activeChatId) subscribeToChat(state.activeChatId);
    }, () => setConnection(false));
  }

  function unsubscribeAllChatSubscriptions() {
    state.subscriptions.forEach((sub) => { try { sub.unsubscribe(); } catch {} });
    state.subscriptions = [];
  }

  function subscribeSystem() {
    if (!state.stompClient) return;
    try {
      const sub = state.stompClient.subscribe('/user/queue/system', (frame) => {
        try {
          const body = JSON.parse(frame.body);
          if (body && body.message) showWarning(bytesToText(body.message) || String(body.message));
        } catch {
          showWarning(frame.body || 'Получено системное уведомление');
        }
      });
      state.subscriptions.push(sub);
    } catch {}
  }

  function subscribeToChat(chatId) {
    if (!state.stompClient || !state.stompClient.connected || !chatId) return;
    unsubscribeAllChatSubscriptions();
    subscribeSystem();
    ['/topic/' + chatId, '/topic/chat/' + chatId].forEach((destination) => {
      try {
        const sub = state.stompClient.subscribe(destination, (frame) => {
          try { upsertMessage(JSON.parse(frame.body)); } catch {}
        });
        state.subscriptions.push(sub);
      } catch {}
    });
  }

  function sendMessage() {
    const text = els.messageInput.value.trim();
    if (!text || !state.activeChatId || !state.stompClient || !state.stompClient.connected) return;
    const payload = {
      chatId: state.activeChatId,
      message: textToBase64(text),
      encryptionName: null,
    };
    state.stompClient.send('/app/send.chat', {}, JSON.stringify(payload));
    upsertMessage({ chatId: state.activeChatId, senderId: state.currentUserId, message: payload.message, createdAt: new Date().toISOString() });
    els.messageInput.value = '';
  }

  function formatTime(value) {
    if (!value) return '';
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    } catch {
      return String(value);
    }
  }

  async function loadInitialData() {
    try {
      const [currentUserId, chats, lastMessages] = await Promise.all([
        api.getCurrentUserId(),
        api.getChats(),
        api.getLastMessages(100).catch(() => []),
      ]);
      state.currentUserId = typeof currentUserId === 'string' ? currentUserId : currentUserId?.id || null;
      els.currentUser.textContent = state.currentUserId ? `ID: ${state.currentUserId}` : 'Пользователь авторизован';
      state.chats = (Array.isArray(chats) ? chats : []).map(normalizeChat);
      const grouped = new Map();
      (Array.isArray(lastMessages) ? lastMessages : []).map(normalizeMessage).forEach((message) => {
        if (!grouped.has(message.chatId)) grouped.set(message.chatId, []);
        grouped.get(message.chatId).push(message);
      });
      state.messagesByChat = grouped;
      renderChats();
    } catch (error) {
      els.currentUser.textContent = 'Не удалось загрузить профиль';
      showWarning(error.message || 'Ошибка загрузки данных');
    }
  }

  async function performSearch() {
    const query = els.userSearch.value.trim();
    try {
      if (!query) return renderSearchResults([], '');
      const results = await api.searchUsers(query);
      renderSearchResults(Array.isArray(results) ? results : [], query);
    } catch (error) {
      renderSearchResults([], query);
      showWarning(error.message || 'Ошибка поиска');
    }
  }

  function bindEvents() {
    els.refreshBtn.addEventListener('click', loadInitialData);
    els.searchBtn.addEventListener('click', performSearch);
    els.userSearch.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });
    els.sendBtn.addEventListener('click', sendMessage);
    els.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  bindEvents();
  loadInitialData().finally(connectWebSocket);
})();
