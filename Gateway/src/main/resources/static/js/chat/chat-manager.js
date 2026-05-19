import { LIMITS } from './constants.js';
import { normalizeBase64 } from './base64.js';
import { buildSearchResults } from './search.js';


export class ChatManager {
  constructor({ api, ui, keyManager, fileUploader, db }) {
    this.api = api;
    this.ui = ui;
    this.keyManager = keyManager;
    this.fileUploader = fileUploader;
    this.db = db;
    this.userId = null;
    this.chats = [];
    this.activeChatId = null;
    this.rawMessagesByChat = new Map();
    this.messagesByChat = new Map();
    this.filesByChat = new Map();
    this.requestedMessageKeys = new Set();
    this.ws = null;
    this.chatListSignature = '';
    this.messageSignatures = new Map();
    this.timelineSignatures = new Map();
    this.openChatRequestId = 0;
    this.previewCache = new Map();
    this.mediaUrlCache = new Map();
    this.systemEventsByChat = new Map();
    this.seenSystemEventIds = new Set();
    this.unreadCounts = new Map();
    this.unreadMessageIds = new Map();
    this.readPositions = new Map();
    this.cachedChatsLoaded = new Set();
    this.historyStateByChat = new Map();
  }

  init(userId) {
    this.userId = userId;
    this.#loadUnreadCounts();
    this.#loadReadPositions();
  }

  setWebSocket(ws) {
    this.ws = ws;
  }

  get activeChat() {
    return this.chats.find((item) => Number(item.chatId) === Number(this.activeChatId)) || null;
  }

  async refreshChats({ force = false } = {}) {
    const previousActiveSignature = this.#chatDetailSignature(this.activeChat);
    const payload = await this.api.getSidebarChats();
    const rows = Array.isArray(payload) ? payload : [];
    const nextChats = await Promise.all(rows.map((row) => this.#normalizeChat(row)));
    for (const chat of nextChats) {
      chat.unreadCount = this.unreadCounts.get(String(chat.chatId)) || 0;
    }
    nextChats.sort((left, right) => {
      const leftTime = new Date(left.lastActivityAt || 0).getTime();
      const rightTime = new Date(right.lastActivityAt || 0).getTime();
      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return Number(right.chatId || 0) - Number(left.chatId || 0);
    });

    const nextSignature = this.#chatsSignature(nextChats);
    if (!force && nextSignature === this.chatListSignature) {
      this.chats = nextChats;
      this.ui.setActiveChatInList(this.activeChatId);
      return;
    }

    this.chats = nextChats;
    this.chatListSignature = nextSignature;
    this.ui.renderChats(this.chats, this.activeChatId, (chatId) => {
      this.openChat(chatId).catch((error) => this.ui.appendStatus(error.message, 'error'));
    });

    if (this.activeChatId) {
      const active = this.activeChat;
      if (active) {
        if (this.#chatDetailSignature(active) !== previousActiveSignature) {
          this.ui.renderActiveChat(active);
          this.ui.renderMembers(active.participants || [], active);
        }
      } else {
        this.activeChatId = null;
        this.ui.renderActiveChat(null);
        this.ui.renderMessages([], this.userId, null);
      }
    }
  }

  async openChat(chatId) {
    const requestId = ++this.openChatRequestId;
    this.activeChatId = Number(chatId);
    this.ui.setActiveChatInList(this.activeChatId);
    this.#setUnreadCount(chatId, 0);
    const chat = this.activeChat;
    this.ui.renderActiveChat(chat);
    this.ui.setHistoryLoadVisible(false);
    this.ui.renderMembers(chat?.participants || [], chat);
    await this.keyManager.ingestPendingMessageKeys();
    if (requestId !== this.openChatRequestId) {
      return;
    }
    await this.#showCachedMessages(chatId, requestId);
    if (requestId !== this.openChatRequestId) {
      return;
    }
    await this.loadMessages(chatId, { force: true, stickToBottom: true });
    if (requestId !== this.openChatRequestId) {
      return;
    }
    this.#loadFilesInBackground(chatId, requestId);
  }

  async loadMessages(chatId, { force = false, preserveScroll = false, stickToBottom = false, includeFiles = false } = {}) {
    if (includeFiles) {
      try {
        await this.loadFiles(chatId);
      } catch (error) {
        this.ui.appendStatus(`Не удалось загрузить файлы чата: ${error.message}`, 'warning');
      }
    }
    const payload = await this.api.getMessages(chatId, LIMITS.defaultMessagePageSize);
    const rows = Array.isArray(payload) ? payload : [];
    const normalizedRows = rows.map((row) => this.#normalizeMessage(row, chatId));
    const signature = this.#messagesSignature(normalizedRows);
    const key = String(chatId);
    const currentRows = this.rawMessagesByChat.get(key) || [];
    const state = this.#historyState(chatId);
    if (currentRows.length > 0) {
      state.messagesDone = state.messagesDone || normalizedRows.length < LIMITS.defaultMessagePageSize;
      const changed = this.#mergeRawMessages(chatId, normalizedRows);
      if (changed) {
        await this.#cacheRawMessages(chatId, this.rawMessagesByChat.get(key) || []);
        const result = await this.refreshVisibleMessages(chatId, { preserveScroll, stickToBottom });
        this.#syncHistoryButton(chatId);
        return result;
      }
      if (force) {
        return this.refreshVisibleMessages(chatId, { preserveScroll, stickToBottom });
      }
      this.#syncHistoryButton(chatId);
      return this.messagesByChat.get(key) || [];
    }
    if (!force && signature === this.messageSignatures.get(key)) {
      this.#syncHistoryButton(chatId);
      return this.messagesByChat.get(key) || [];
    }

    state.messagesDone = normalizedRows.length < LIMITS.defaultMessagePageSize;
    this.messageSignatures.set(key, signature);
    this.rawMessagesByChat.set(key, normalizedRows);
    await this.#cacheRawMessages(chatId, normalizedRows);
    const result = await this.refreshVisibleMessages(chatId, { preserveScroll, stickToBottom });
    this.#syncHistoryButton(chatId);
    return result;
  }

  async #showCachedMessages(chatId, requestId) {
    const key = String(chatId);
    const inMemoryRows = this.messagesByChat.get(key) || [];
    if (inMemoryRows.length > 0) {
      this.#renderTimeline(chatId, this.#timeline(chatId, inMemoryRows), { stickToBottom: true, force: true });
      return;
    }

    if (!this.db || !this.userId || this.cachedChatsLoaded.has(key)) {
      return;
    }

    const cachedRows = await this.db.getCachedMessages(this.userId, chatId);
    if (requestId !== this.openChatRequestId || cachedRows.length === 0) {
      return;
    }

    const normalizedRows = cachedRows.map((row) => ({
      messageId: row.messageId,
      senderId: row.senderId,
      senderUsername: row.senderUsername || null,
      senderAvatarUrl: row.senderAvatarUrl || null,
      createdAt: row.createdAt || null,
      chatId: row.chatId || chatId,
      encryptionName: row.encryptionName || row.encryptName || null,
      messageB64: normalizeBase64(row.messageB64 || row.message) || ''
    }));

    this.cachedChatsLoaded.add(key);
    this.messageSignatures.set(key, this.#messagesSignature(normalizedRows));
    this.rawMessagesByChat.set(key, normalizedRows);
    await this.refreshVisibleMessages(chatId, { stickToBottom: true });
  }

  async #loadFilesInBackground(chatId, requestId) {
    try {
      await this.loadFiles(chatId);
      if (requestId === this.openChatRequestId && Number(chatId) === Number(this.activeChatId)) {
        this.#renderTimeline(chatId, this.#timeline(chatId), { preserveScroll: true, force: true });
      }
    } catch (error) {
      this.ui.appendStatus(`РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ С„Р°Р№Р»С‹ С‡Р°С‚Р°: ${error.message}`, 'warning');
    }
  }

  async loadFiles(chatId) {
    const payload = await this.api.getChatFiles(chatId, { limit: LIMITS.defaultFilePageSize });
    const files = (Array.isArray(payload) ? payload : [])
      .map((file) => this.#normalizeFile(file, chatId))
      .filter(Boolean);
    await Promise.all(files.map((file) => this.#ensureMediaPreviewUrl(file)));
    this.#historyState(chatId).filesDone = files.length < LIMITS.defaultFilePageSize;
    this.filesByChat.set(String(chatId), files);
    this.#syncHistoryButton(chatId);
    return files;
  }

  async loadOlderTimeline({ retry = false } = {}) {
    const chatId = this.activeChatId;
    if (!chatId) {
      return;
    }

    const state = this.#historyState(chatId);
    if (state.loadingOlder) {
      return;
    }
    if (retry && state.messagesDone && state.filesDone) {
      state.messagesDone = false;
      state.filesDone = false;
    }
    if (state.messagesDone && state.filesDone && !retry) {
      state.historyNotice = true;
      this.#syncHistoryButton(chatId);
      return;
    }

    const beforeCount = this.#timeline(chatId).length;
    state.loadingOlder = true;
    state.historyNotice = false;
    this.#syncHistoryButton(chatId);
    this.#renderTimeline(chatId, this.#timeline(chatId), { preserveScroll: true, force: true });
    try {
      const [messagesChanged, filesChanged] = await Promise.all([
        state.messagesDone ? Promise.resolve(false) : this.#loadOlderMessages(chatId, state),
        state.filesDone ? Promise.resolve(false) : this.#loadOlderFiles(chatId, state)
      ]);

      if (Number(chatId) !== Number(this.activeChatId)) {
        return;
      }
      if (messagesChanged) {
        await this.refreshVisibleMessages(chatId, { preserveScroll: true });
      } else if (filesChanged) {
        this.#renderTimeline(chatId, this.#timeline(chatId), { preserveScroll: true, force: true });
      }

      const afterCount = this.#timeline(chatId).length;
      state.historyNotice = afterCount <= beforeCount;
    } catch (error) {
      state.historyNotice = true;
      throw error;
    } finally {
      state.loadingOlder = false;
      this.#syncHistoryButton(chatId);
      if (Number(chatId) === Number(this.activeChatId)) {
        this.#renderTimeline(chatId, this.#timeline(chatId), { preserveScroll: true, force: true });
      }
    }
  }

  async refreshVisibleMessages(chatId = this.activeChatId, { preserveScroll = false, stickToBottom = false } = {}) {
    if (!chatId) {
      return [];
    }

    const rawRows = this.rawMessagesByChat.get(String(chatId)) || [];
    const visibleMessages = [];

    for (const row of rawRows) {
      const text = await this.keyManager.decryptMessage(row.messageB64, row.encryptionName);
      if (text === null) {
        await this.#requestMissingSenderKeyForMessage(row, this.ws);
        continue;
      }
      visibleMessages.push({ ...row, text });
    }

    visibleMessages.sort((left, right) => {
      const leftTime = new Date(left.createdAt || 0).getTime();
      const rightTime = new Date(right.createdAt || 0).getTime();
      return leftTime - rightTime || Number(left.messageId || 0) - Number(right.messageId || 0);
    });

    this.messagesByChat.set(String(chatId), visibleMessages);
      if (Number(chatId) === Number(this.activeChatId)) {
        this.#renderTimeline(chatId, this.#timeline(chatId, visibleMessages), { preserveScroll, stickToBottom, force: stickToBottom });
        this.#markChatReadFromRows(chatId, rawRows);
        this.#syncHistoryButton(chatId);
      }
      return visibleMessages;
    }

  async sendMessage(text) {
    if (!this.activeChatId) {
      throw new Error('Сначала выберите чат.');
    }

    const clean = String(text || '').trim();
    if (!clean) {
      throw new Error('Введите текст сообщения.');
    }
    if (Array.from(clean).length > LIMITS.maxMessageChars) {
      throw new Error(`Сообщение должно быть не длиннее ${LIMITS.maxMessageChars} символов.`);
    }

    const members = this.#memberIds(this.activeChat);
    const senderKey = await this.keyManager.ensureSenderKey(this.activeChatId, members);
    const encrypted = await this.keyManager.crypto.encryptMessage(clean, senderKey.keyB64);

    const created = await this.api.sendMessage({
      chatId: this.activeChatId,
      message: encrypted,
      encryptionName: senderKey.encryptName
    });
    this.#setReadPosition(this.activeChatId, created.messageId);

    await this.keyManager.incrementUsage(this.activeChatId, senderKey.encryptName);

    const rawCurrent = this.rawMessagesByChat.get(String(this.activeChatId)) || [];
    rawCurrent.push({
      messageId: created.messageId,
      senderId: this.userId,
      createdAt: created.createdAt || new Date().toISOString(),
      chatId: this.activeChatId,
      encryptionName: senderKey.encryptName,
      messageB64: encrypted
    });
    this.rawMessagesByChat.set(String(this.activeChatId), rawCurrent);
    this.messageSignatures.set(String(this.activeChatId), this.#messagesSignature(rawCurrent));
    await this.#cacheRawMessages(this.activeChatId, rawCurrent);

    const current = this.messagesByChat.get(String(this.activeChatId)) || [];
    current.push({
      messageId: created.messageId,
      senderId: this.userId,
      createdAt: created.createdAt || new Date().toISOString(),
      chatId: this.activeChatId,
      encryptionName: senderKey.encryptName,
      messageB64: encrypted,
      text: clean
    });
    this.messagesByChat.set(String(this.activeChatId), current);
    this.#renderTimeline(this.activeChatId, this.#timeline(this.activeChatId, current), { stickToBottom: true, force: true });
    await this.refreshChats();
  }

  async sendFile(file) {
    if (!this.activeChatId) {
      throw new Error('Сначала выберите чат.');
    }
    this.#validateChatFile(file);

    this.ui.setFileUploadState('Загружаю файл', 0);
    try {
      const created = await this.fileUploader.uploadChatFile(this.activeChatId, file, (progress) => {
        this.ui.setFileUploadState('Загружаю файл', progress);
      });
      const normalized = this.#normalizeFile(created, this.activeChatId);
      if (normalized) {
        await this.#ensureMediaPreviewUrl(normalized);
        this.#upsertFile(normalized);
        this.#renderTimeline(this.activeChatId, this.#timeline(this.activeChatId), { stickToBottom: true, force: true });
      }
      this.ui.appendStatus('Файл загружен и отправлен в чат.', 'ok');
      await this.refreshChats();
    } finally {
      this.ui.setFileUploadState('');
    }
  }

  async openFile(fileId) {
    if (!fileId) {
      return;
    }
    const response = await this.api.getFileDownloadUrl(fileId);
    if (!response?.downloadUrl) {
      throw new Error('Сервер не вернул ссылку на скачивание файла.');
    }
    window.open(response.downloadUrl, '_blank', 'noopener');
  }

  async deleteMessage(messageId) {
    if (!this.activeChatId || !messageId) {
      return;
    }

    await this.api.deleteMessage({
      chatId: this.activeChatId,
      messageId
    });

    const rawRows = (this.rawMessagesByChat.get(String(this.activeChatId)) || [])
      .filter((row) => Number(row.messageId) !== Number(messageId));
    const visibleRows = (this.messagesByChat.get(String(this.activeChatId)) || [])
      .filter((row) => Number(row.messageId) !== Number(messageId));

    this.rawMessagesByChat.set(String(this.activeChatId), rawRows);
    this.messageSignatures.set(String(this.activeChatId), this.#messagesSignature(rawRows));
    this.messagesByChat.set(String(this.activeChatId), visibleRows);
    await this.#cacheRawMessages(this.activeChatId, rawRows);
    this.#renderTimeline(this.activeChatId, this.#timeline(this.activeChatId, visibleRows), { preserveScroll: true, force: true });
    await this.refreshChats({ force: true });
  }

  async deleteActiveChat() {
    if (!this.activeChatId) {
      throw new Error('Сначала выберите чат.');
    }

    await this.api.deleteChat(this.activeChatId);
    this.rawMessagesByChat.delete(String(this.activeChatId));
    this.messagesByChat.delete(String(this.activeChatId));
    this.filesByChat.delete(String(this.activeChatId));
    this.historyStateByChat.delete(String(this.activeChatId));
    this.timelineSignatures.delete(String(this.activeChatId));
    await this.db?.deleteCachedMessages?.(this.userId, this.activeChatId);
    this.#setUnreadCount(this.activeChatId, 0);
    this.activeChatId = null;
    this.ui.renderActiveChat(null);
    this.ui.renderMessages([], this.userId, null);
    await this.refreshChats({ force: true });
  }

  async leaveActiveGroup() {
    const chat = this.activeChat;
    if (!chat?.chatId) {
      throw new Error('Сначала выберите группу.');
    }
    if (chat.chatType !== 'GROUP') {
      throw new Error('Покинуть можно только групповой чат.');
    }

    const chatId = chat.chatId;
    await this.api.removeUserInChat(chatId, this.userId);

    this.rawMessagesByChat.delete(String(chatId));
    this.messagesByChat.delete(String(chatId));
    this.filesByChat.delete(String(chatId));
    this.historyStateByChat.delete(String(chatId));
    this.timelineSignatures.delete(String(chatId));
    this.messageSignatures.delete(String(chatId));
    await this.db?.deleteCachedMessages?.(this.userId, chatId);
    this.#setUnreadCount(chatId, 0);

    this.activeChatId = null;
    this.ui.renderActiveChat(null);
    this.ui.renderMessages([], this.userId, null);
    await this.refreshChats({ force: true });
    this.ws?.syncChats?.(this.chats.map((item) => item.chatId));
  }

  async searchDialogs(query) {
    const clean = String(query || '').trim();
    if (!clean) {
      throw new Error('Введите запрос для поиска.');
    }

    const remoteUsers = await this.api.searchUsers(clean);
    return buildSearchResults({
      chats: this.chats,
      remoteUsers,
      query: clean,
      selfUserId: this.userId,
      unreadCounts: this.unreadCounts
    });
  }

  async openSearchResult(result) {
    if (!result) {
      return;
    }

    if (result.chatId) {
      if (!this.chats.find((chat) => Number(chat.chatId) === Number(result.chatId))) {
        await this.refreshChats({ force: true });
      }
      await this.openChat(result.chatId);
      return;
    }

    await this.createPersonalChatByUsername(result.title);
  }

  async createPersonalChatByUsername(username) {
    const userId = await this.api.getIdByUsername(username);
    return this.openPersonalChatByUserId(userId);
  }

  async openPersonalChatByUserId(userId) {
    if (!userId) {
      throw new Error('Не удалось определить пользователя для диалога.');
    }

    if (String(userId) === String(this.userId)) {
      throw new Error('Это ваш профиль. Диалог с самим собой не создается.');
    }

    const existing = this.chats.find((chat) => (
      chat.chatType === 'PERSONAL' && String(chat.counterpartUserId) === String(userId)
    ));
    if (existing?.chatId) {
      await this.openChat(existing.chatId);
      return existing;
    }

    const created = await this.api.createPersonalChat(userId);
    if (!created?.chatId) {
      throw new Error('Сервер не вернул chatId личного чата.');
    }
    await this.refreshChats({ force: true });
    await this.openChat(created.chatId);
    return created;
  }

  async createGroupChat(title) {
    const clean = String(title || '').trim();
    if (!clean) {
      throw new Error('Введите название группы.');
    }

    const created = await this.api.createGroupChat(clean, '');
    await this.refreshChats({ force: true });
    if (created?.chatId) {
      await this.openChat(created.chatId);
    }
  }

  async memberAction(action, username, selectedUserId = null) {
    const chat = this.activeChat;
    if (!chat?.chatId) {
      throw new Error('Сначала выберите чат.');
    }

    let userTarget = null;
    const clean = String(username || '').trim();

    if (chat.chatType === 'PERSONAL' && ['block', 'unblock'].includes(action)) {
      userTarget = chat.counterpartUserId;
    } else if (selectedUserId) {
      userTarget = selectedUserId;
    } else {
      if (!clean) {
        throw new Error('Введите username участника.');
      }
      userTarget = await this.api.getIdByUsername(clean);
    }

    if (!userTarget) {
      throw new Error('Не удалось определить пользователя для действия.');
    }

    if (action === 'add') {
      await this.api.addUserInChat(chat.chatId, userTarget);
      await this.#safeShareAllSenderKeysForChatWithUsers(chat.chatId, [userTarget]);
    } else if (action === 'remove') {
      await this.api.removeUserInChat(chat.chatId, userTarget);
    } else if (action === 'block') {
      await this.api.blockUserInChat(chat.chatId, userTarget);
    } else if (action === 'unblock') {
      await this.api.unblockUserInChat(chat.chatId, userTarget);
    }

    await this.refreshChats({ force: true });
    if (this.activeChatId) {
      this.ui.renderMembers(this.activeChat?.participants || [], this.activeChat);
    }
  }

  async searchUsersOnly(query) {
    const clean = String(query || '').trim();
    if (clean.length < 2) {
      return [];
    }

    const participantIds = new Set((this.activeChat?.participants || [])
      .map((item) => String(item.userId || ''))
      .filter(Boolean));

    const users = await this.api.searchUsers(clean);
    return (Array.isArray(users) ? users : [])
      .filter((user) => {
        const userId = String(user?.id || user?.userId || '');
        const username = String(user?.username || '');
        if (!userId || String(userId) === String(this.userId)) {
          return false;
        }
        if (participantIds.has(userId)) {
          return false;
        }
        return username.toLocaleLowerCase('ru-RU').includes(clean.toLocaleLowerCase('ru-RU'));
      })
      .slice(0, 10);
  }

  async handleRealtimeEvent(payload, ws = null) {
    const type = String(payload?.type || '').toUpperCase();
    if (type === 'SEND') {
      this.#trackUnreadFromRealtime(payload);
      await this.#requestMissingSenderKeyForRealtimeMessage(payload, ws);
      await this.#upsertRealtimeMessage(payload);
    }
    if (type === 'USER_SYNC') {
      this.#trackUnreadFromUserSync(payload);
      await this.#upsertRealtimeMessages(payload?.payload?.messages);
    }
    if (type === 'MESSAGE_KEY_REQUEST') {
      await this.#answerMessageKeyRequest(payload);
    }
    if (type === 'FILE_READY') {
      await this.#trackFileReady(payload);
    }
    if (type === 'NEW_USER_IN_CHAT') {
      this.#trackNewUserInChat(payload);
    }
  }

  canDeleteMessage(message) {
    const chat = this.activeChat;
    if (!chat || !message) {
      return false;
    }
    if (String(message.senderId) === String(this.userId)) {
      return true;
    }
    return chat.chatType === 'GROUP'
      && ['ADMIN', 'CREATOR'].includes(String(chat.currentUserRole || '').toUpperCase());
  }

  async #upsertRealtimeMessage(payload) {
    const rawMessage = payload?.payload?.message || payload?.message;
    if (!rawMessage) {
      return false;
    }

    const chatId = rawMessage?.chat?.chatId || rawMessage?.chatId || payload?.payload?.chatId || payload?.chatId;
    if (!chatId) {
      return false;
    }

    const row = this.#normalizeMessage(rawMessage, chatId);
    if (!row.messageId || !row.messageB64) {
      return false;
    }

    const changed = this.#mergeRawMessages(chatId, [row]);
    if (!changed) {
      return false;
    }

    await this.#cacheRawMessages(chatId, this.rawMessagesByChat.get(String(chatId)) || []);
    if (Number(chatId) === Number(this.activeChatId)) {
      await this.refreshVisibleMessages(chatId);
    }
    return true;
  }

  async #upsertRealtimeMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return false;
    }

    const rowsByChat = new Map();
    for (const message of messages) {
      const chatId = message?.chat?.chatId || message?.chatId;
      if (!chatId) {
        continue;
      }
      const row = this.#normalizeMessage(message, chatId);
      if (!row.messageId || !row.messageB64) {
        continue;
      }
      const key = String(chatId);
      rowsByChat.set(key, [...(rowsByChat.get(key) || []), row]);
    }

    let changed = false;
    for (const [chatKey, rows] of rowsByChat) {
      const chatId = Number(chatKey);
      if (this.#mergeRawMessages(chatId, rows)) {
        changed = true;
        await this.#cacheRawMessages(chatId, this.rawMessagesByChat.get(chatKey) || []);
        if (Number(chatId) === Number(this.activeChatId)) {
          await this.refreshVisibleMessages(chatId, { preserveScroll: true });
        }
      }
    }
    return changed;
  }

  async #loadOlderMessages(chatId, state) {
    const current = this.rawMessagesByChat.get(String(chatId)) || [];
    const oldest = current
      .filter((message) => message.messageId)
      .sort((left, right) => Number(left.messageId) - Number(right.messageId))[0];
    if (!oldest?.messageId) {
      state.messagesDone = true;
      return false;
    }

    const payload = await this.api.getMessagesRelative(oldest.messageId, -LIMITS.defaultMessagePageSize);
    const olderRows = (Array.isArray(payload) ? payload : [])
      .map((row) => this.#normalizeMessage(row, chatId))
      .filter((row) => row.messageId);
    state.messagesDone = olderRows.length < LIMITS.defaultMessagePageSize;
    if (olderRows.length === 0) {
      return false;
    }

    const changed = this.#mergeRawMessages(chatId, olderRows);
    if (changed) {
      await this.#cacheRawMessages(chatId, this.rawMessagesByChat.get(String(chatId)) || []);
    }
    return changed;
  }

  async #loadOlderFiles(chatId, state) {
    const current = this.filesByChat.get(String(chatId)) || [];
    const oldest = current
      .filter((file) => file.fileId && file.createdAt)
      .sort((left, right) => new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime())[0];
    if (!oldest?.fileId) {
      state.filesDone = true;
      return false;
    }

    const payload = await this.api.getChatFiles(chatId, {
      limit: LIMITS.defaultFilePageSize,
      beforeFileId: oldest.fileId
    });
    const olderFiles = (Array.isArray(payload) ? payload : [])
      .map((file) => this.#normalizeFile(file, chatId))
      .filter(Boolean);
    state.filesDone = olderFiles.length < LIMITS.defaultFilePageSize;
    if (olderFiles.length === 0) {
      return false;
    }

    await Promise.all(olderFiles.map((file) => this.#ensureMediaPreviewUrl(file)));
    return this.#mergeFiles(chatId, olderFiles);
  }

  #validateChatFile(file) {
    if (!file) {
      throw new Error('Выберите файл для отправки.');
    }
    if (file.size > LIMITS.fileMaxBytes) {
      throw new Error('Файл должен быть не больше 100 МБ.');
    }
  }

  #normalizeMessage(row, fallbackChatId = null) {
    return {
      messageId: row.messageId,
      senderId: row.senderId,
      senderUsername: row.senderUsername || row.sender?.username || null,
      senderAvatarUrl: row.senderAvatarUrl || row.sender?.avatarUrl || null,
      createdAt: row.createdAt || null,
      chatId: row.chatId || row.chat?.chatId || fallbackChatId,
      encryptionName: row.encryptionName || row.encryptName || null,
      messageB64: normalizeBase64(row.messageB64 || row.message) || ''
    };
  }

  #normalizeFile(file, fallbackChatId = null) {
    if (!file?.fileId) {
      return null;
    }
    const chatId = file.chat?.chatId || file.chatId || fallbackChatId;
    if (!chatId) {
      return null;
    }
    return {
      kind: 'file',
      fileId: file.fileId,
      chatId,
      senderId: file.senderId,
      createdAt: file.createdAt || new Date().toISOString(),
      fileType: file.fileType || '',
      mimeType: file.mimeType || '',
      sizeBytes: file.sizeBytes || 0,
      originalFileName: file.originalFileName || 'file',
      previewUrl: file.previewUrl || ''
    };
  }

  #upsertFile(file) {
    const key = String(file.chatId);
    const current = this.filesByChat.get(key) || [];
    const next = current.filter((item) => String(item.fileId) !== String(file.fileId));
    next.push(file);
    this.filesByChat.set(key, this.#sortFiles(next));
  }

  #mergeRawMessages(chatId, rows) {
    const key = String(chatId);
    const byId = new Map((this.rawMessagesByChat.get(key) || [])
      .filter((message) => message.messageId)
      .map((message) => [String(message.messageId), message]));
    for (const row of rows) {
      byId.set(String(row.messageId), row);
    }
    const next = this.#sortMessages(Array.from(byId.values()));
    const nextSignature = this.#messagesSignature(next);
    if (nextSignature === this.messageSignatures.get(key)) {
      return false;
    }
    this.messageSignatures.set(key, nextSignature);
    this.rawMessagesByChat.set(key, next);
    return true;
  }

  #mergeFiles(chatId, files) {
    const key = String(chatId);
    const byId = new Map((this.filesByChat.get(key) || [])
      .filter((file) => file.fileId)
      .map((file) => [String(file.fileId), file]));
    for (const file of files) {
      byId.set(String(file.fileId), file);
    }
    const currentSignature = this.#filesSignature(this.filesByChat.get(key) || []);
    const next = this.#sortFiles(Array.from(byId.values()));
    const nextSignature = this.#filesSignature(next);
    if (nextSignature === currentSignature) {
      return false;
    }
    this.filesByChat.set(key, next);
    return true;
  }

  #sortMessages(messages) {
    return [...(messages || [])].sort((left, right) => {
      const leftTime = new Date(left.createdAt || 0).getTime();
      const rightTime = new Date(right.createdAt || 0).getTime();
      return leftTime - rightTime || Number(left.messageId || 0) - Number(right.messageId || 0);
    });
  }

  #sortFiles(files) {
    return [...(files || [])].sort((left, right) => {
      const leftTime = new Date(left.createdAt || 0).getTime();
      const rightTime = new Date(right.createdAt || 0).getTime();
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      return String(left.fileId || '').localeCompare(String(right.fileId || ''));
    });
  }

  #historyState(chatId) {
    const key = String(chatId);
    if (!this.historyStateByChat.has(key)) {
      this.historyStateByChat.set(key, {
        loadingOlder: false,
        messagesDone: false,
        filesDone: false,
        historyNotice: false
      });
    }
    return this.historyStateByChat.get(key);
  }

  #syncHistoryButton(chatId = this.activeChatId) {
    if (!chatId || Number(chatId) !== Number(this.activeChatId)) {
      this.ui.setHistoryLoadVisible(false);
      return;
    }
    const state = this.#historyUiState(chatId);
    this.ui.setHistoryLoadVisible(state.visible, state.loading, state.notice);
  }

  #historyUiState(chatId = this.activeChatId) {
    const state = this.#historyState(chatId);
    return {
      visible: state.historyNotice || !(state.messagesDone && state.filesDone),
      loading: state.loadingOlder,
      notice: state.historyNotice
    };
  }

  #timeline(chatId, messages = null) {
    const rows = messages || this.messagesByChat.get(String(chatId)) || [];
    const files = this.filesByChat.get(String(chatId)) || [];
    const systemEvents = this.systemEventsByChat.get(String(chatId)) || [];
    return [...rows, ...files, ...systemEvents].sort((left, right) => {
      const leftTime = new Date(left.createdAt || 0).getTime();
      const rightTime = new Date(right.createdAt || 0).getTime();
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      const leftId = left.kind === 'file' ? String(left.fileId || '') : String(left.messageId || left.eventId || '');
      const rightId = right.kind === 'file' ? String(right.fileId || '') : String(right.messageId || right.eventId || '');
      return leftId.localeCompare(rightId);
    });
  }

  #renderTimeline(chatId, timeline, options = {}) {
    const key = String(chatId);
    const signature = this.#timelineSignature(timeline);
    if (!options.force && !options.stickToBottom && signature === this.timelineSignatures.get(key)) {
      return;
    }
    this.timelineSignatures.set(key, signature);
    this.ui.renderMessages(timeline, this.userId, this.activeChat, {
      ...options,
      history: this.#historyUiState(chatId)
    });
  }

  async #cacheRawMessages(chatId, rawRows) {
    if (!this.db || !this.userId || !chatId) {
      return;
    }
    try {
      await this.db.setCachedMessages(this.userId, chatId, rawRows);
    } catch (error) {
      this.ui.appendStatus(`РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ Р»РѕРєР°Р»СЊРЅС‹Р№ РєСЌС€ С‡Р°С‚Р°: ${error.message}`, 'warning');
    }
  }

  #timelineSignature(items) {
    return (items || [])
      .map((item) => [
        item.kind || 'message',
        item.messageId || item.fileId || item.eventId || '',
        item.senderId || '',
        item.createdAt || '',
        item.text || '',
        item.encryptionName || '',
        item.status || '',
        item.originalFileName || '',
        item.sizeBytes || 0,
        item.previewUrl || ''
      ].join('|'))
      .join('~');
  }

  #filesSignature(files) {
    return (files || [])
      .map((file) => [
        file.fileId,
        file.createdAt,
        file.status,
        file.originalFileName,
        file.sizeBytes,
        file.previewUrl
      ].join('|'))
      .join('~');
  }

  #trackNewUserInChat(payload) {
    const entity = payload?.payload?.chatUserEntity || payload?.chatUserEntity;
    const chatId = entity?.chat?.chatId || entity?.chatId;
    const userId = entity?.userId;
    const role = String(entity?.role || '').toUpperCase();
    if (!chatId || !userId || role === 'CREATOR') {
      return;
    }

    const joinedAt = entity?.joinedAt || null;
    const createdAt = joinedAt || new Date().toISOString();
    const eventId = ['new-user', chatId, userId, joinedAt || role || 'member'].map(String).join(':');
    if (this.seenSystemEventIds.has(eventId)) {
      return;
    }
    this.seenSystemEventIds.add(eventId);

    const username = entity?.username || this.#shortUserId(userId);
    const event = {
      kind: 'system',
      eventId,
      chatId,
      createdAt,
      text: `${username} добавлен(а) в группу`
    };

    const key = String(chatId);
    const current = this.systemEventsByChat.get(key) || [];
    current.push(event);
    this.systemEventsByChat.set(key, current.slice(-80));

    if (Number(chatId) === Number(this.activeChatId)) {
      this.#renderTimeline(chatId, this.#timeline(chatId), { preserveScroll: true });
    }
  }

  async #trackFileReady(payload) {
    const file = this.#normalizeFile(payload?.payload?.file || payload?.file);
    if (!file || String(file.senderId) === String(this.userId)) {
      return;
    }
    await this.#ensureMediaPreviewUrl(file);
    this.#upsertFile(file);
    if (Number(file.chatId) === Number(this.activeChatId)) {
      this.#renderTimeline(file.chatId, this.#timeline(file.chatId), { preserveScroll: true });
      return;
    }
    this.#incrementUnreadCount(file.chatId, file.fileId);
  }

  #isInlineMedia(file) {
    const type = String(file?.fileType || '').toUpperCase();
    const mime = String(file?.mimeType || '').toLowerCase();
    return type === 'IMAGE'
      || type === 'VIDEO'
      || type === 'AUDIO'
      || mime.startsWith('image/')
      || mime.startsWith('video/')
      || mime.startsWith('audio/');
  }

  async #ensureMediaPreviewUrl(file) {
    if (!this.#isInlineMedia(file) || !file?.fileId) {
      return file;
    }

    const cached = this.mediaUrlCache.get(String(file.fileId));
    if (cached && (!cached.expiresAt || new Date(cached.expiresAt).getTime() - Date.now() > 30_000)) {
      file.previewUrl = cached.url;
      return file;
    }

    try {
      const response = await this.api.getFileDownloadUrl(file.fileId, { inline: true });
      if (response?.downloadUrl) {
        file.previewUrl = response.downloadUrl;
        this.mediaUrlCache.set(String(file.fileId), {
          url: response.downloadUrl,
          expiresAt: response.downloadUrlExpiresAt || null
        });
      }
    } catch (error) {
      console.warn('Не удалось получить ссылку предпросмотра файла.', {
        fileId: file.fileId,
        error: error?.message || error
      });
    }

    return file;
  }

  async #normalizeChat(row) {
    const chatType = this.#normalizeChatType(row.chatType);
    const participants = this.#normalizeParticipants(row.participants);
    const previewText = await this.#decryptPreview(row.lastMessage, row.encryptName);
    return {
      chatId: row.chatId,
      chatType,
      title: row.title || `Чат #${row.chatId}`,
      avatarUrl: row.avatarUrl || this.#fallbackAvatar(chatType, participants),
      lastActivityAt: row.lastActivityAt || null,
      previewText,
      counterpartUserId: row.counterpartUserId || null,
      counterpartUsername: this.#resolveCounterpartUsername(chatType, row, participants),
      counterpartOnline: Boolean(row.counterpartOnline),
      currentUserRole: row.currentUserRole || '',
      canManageMembers: Boolean(row.canManageMembers),
      canDeleteChat: Boolean(row.canDeleteChat),
      memberCount: Number(row.memberCount || participants.length || 0),
      onlineCount: Number(row.onlineCount || participants.filter((item) => item.online).length || 0),
      memberUsernames: Array.isArray(row.memberUsernames) ? row.memberUsernames : participants.map((item) => item.username),
      participants,
      encryptName: row.encryptName || null,
      lastMessageB64: normalizeBase64(row.lastMessage) || ''
    };
  }

  #normalizeChatType(value) {
    const normalized = String(value || '').toUpperCase();
    return normalized.includes('GROUP') ? 'GROUP' : 'PERSONAL';
  }

  #normalizeParticipants(participants) {
    if (!Array.isArray(participants)) {
      return [];
    }
    return participants.map((item) => ({
      userId: item.userId || null,
      username: item.username || item.userId || 'Участник',
      avatarUrl: item.avatarUrl || '',
      online: Boolean(item.online)
    }));
  }

  async #decryptPreview(message, encryptName) {
    const messageB64 = normalizeBase64(message);
    if (!messageB64 || !encryptName) {
      return '';
    }
    const cacheKey = `${encryptName}:${messageB64}`;
    if (this.previewCache.has(cacheKey)) {
      return this.previewCache.get(cacheKey);
    }

    try {
      const text = await this.keyManager.decryptMessage(messageB64, encryptName) || '';
      this.previewCache.set(cacheKey, text);
      if (this.previewCache.size > 300) {
        this.previewCache.delete(this.previewCache.keys().next().value);
      }
      return text;
    } catch {
      return '';
    }
  }

  #fallbackAvatar(chatType, participants) {
    if (chatType === 'PERSONAL') {
      const counterpart = participants.find((item) => String(item.userId) !== String(this.userId));
      return counterpart?.avatarUrl || '';
    }
    return '';
  }

  #resolveCounterpartUsername(chatType, row, participants) {
    if (chatType !== 'PERSONAL') {
      return '';
    }

    const counterpart = (participants || []).find((item) => String(item.userId) !== String(this.userId));
    return counterpart?.username || row.counterpartUsername || row.title || '';
  }

  #chatsSignature(chats) {
    return JSON.stringify((chats || []).map((chat) => ({
      id: chat.chatId,
      type: chat.chatType,
      title: chat.title,
      avatar: chat.avatarUrl,
      activity: chat.lastActivityAt,
      preview: chat.previewText,
      online: chat.counterpartOnline,
      members: chat.memberCount,
      onlineCount: chat.onlineCount,
      role: chat.currentUserRole,
      unread: chat.unreadCount || 0,
      participants: (chat.participants || []).map((item) => [
        item.userId,
        item.username,
        item.avatarUrl,
        item.online
      ])
    })));
  }

  #chatDetailSignature(chat) {
    if (!chat) {
      return '';
    }

    return JSON.stringify({
      id: chat.chatId,
      type: chat.chatType,
      title: chat.title,
      avatar: chat.avatarUrl,
      activity: chat.lastActivityAt,
      online: chat.counterpartOnline,
      members: chat.memberCount,
      onlineCount: chat.onlineCount,
      role: chat.currentUserRole,
      canManageMembers: chat.canManageMembers,
      participants: (chat.participants || []).map((item) => [
        item.userId,
        item.username,
        item.avatarUrl,
        item.online
      ])
    });
  }

  #shortUserId(userId) {
    const value = String(userId || '');
    if (!value) {
      return 'Пользователь';
    }
    if (value.length <= 12) {
      return value;
    }
    return `${value.slice(0, 8)}...${value.slice(-4)}`;
  }

  #loadUnreadCounts() {
    this.unreadCounts = new Map();
    this.unreadMessageIds = new Map();

    const storage = this.#localStorage();
    if (!storage || !this.userId) {
      return;
    }

    try {
      const raw = storage.getItem(this.#unreadStorageKey());
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      Object.entries(parsed || {}).forEach(([chatId, value]) => {
        const count = typeof value === 'number'
          ? Number(value)
          : Number(value?.count || 0);
        const messageIds = typeof value === 'object' && Array.isArray(value?.messageIds)
          ? value.messageIds.map(String)
          : [];

        if (Number.isFinite(count) && count > 0) {
          this.unreadCounts.set(String(chatId), Math.floor(count));
        }
        if (messageIds.length > 0) {
          this.unreadMessageIds.set(String(chatId), new Set(messageIds));
        }
      });
    } catch (error) {
      console.warn('Не удалось прочитать локальные счётчики новых сообщений.', error);
      this.unreadCounts = new Map();
      this.unreadMessageIds = new Map();
    }
  }

  #saveUnreadCounts() {
    const storage = this.#localStorage();
    if (!storage || !this.userId) {
      return;
    }

    const payload = {};
    this.unreadCounts.forEach((count, chatId) => {
      if (!Number.isFinite(count) || count <= 0) {
        return;
      }
      payload[chatId] = {
        count: Math.floor(count),
        messageIds: Array.from(this.unreadMessageIds.get(chatId) || []).slice(-500)
      };
    });

    try {
      storage.setItem(this.#unreadStorageKey(), JSON.stringify(payload));
    } catch (error) {
      console.warn('Не удалось сохранить локальные счётчики новых сообщений.', error);
    }
  }

  #loadReadPositions() {
    this.readPositions = new Map();

    const storage = this.#localStorage();
    if (!storage || !this.userId) {
      return;
    }

    try {
      const raw = storage.getItem(this.#readPositionStorageKey());
      const parsed = raw ? JSON.parse(raw) : {};
      Object.entries(parsed || {}).forEach(([chatId, messageId]) => {
        const normalized = Number(messageId);
        if (Number.isFinite(normalized) && normalized > 0) {
          this.readPositions.set(String(chatId), normalized);
        }
      });
    } catch (error) {
      console.warn('Не удалось прочитать локальные позиции прочтения.', error);
      this.readPositions = new Map();
    }
  }

  #saveReadPositions() {
    const storage = this.#localStorage();
    if (!storage || !this.userId) {
      return;
    }

    const payload = {};
    this.readPositions.forEach((messageId, chatId) => {
      if (Number.isFinite(messageId) && messageId > 0) {
        payload[chatId] = messageId;
      }
    });

    try {
      storage.setItem(this.#readPositionStorageKey(), JSON.stringify(payload));
    } catch (error) {
      console.warn('Не удалось сохранить локальные позиции прочтения.', error);
    }
  }

  #unreadStorageKey() {
    return `mescat:unread:v1:${this.userId}`;
  }

  #readPositionStorageKey() {
    return `mescat:read-position:v1:${this.userId}`;
  }

  #localStorage() {
    try {
      return globalThis.localStorage || null;
    } catch (error) {
      console.warn('Локальное хранилище недоступно, счётчики новых сообщений не будут сохранены.', error);
      return null;
    }
  }

  #setReadPosition(chatId, messageId) {
    if (!chatId || !messageId) {
      return;
    }

    const key = String(chatId);
    const nextId = Number(messageId);
    const currentId = Number(this.readPositions.get(key) || 0);
    if (!Number.isFinite(nextId) || nextId <= currentId) {
      return;
    }

    this.readPositions.set(key, nextId);
    this.#saveReadPositions();
  }

  #markChatReadFromRows(chatId, rows) {
    const maxMessageId = Math.max(
      0,
      ...(rows || []).map((row) => Number(row.messageId) || 0)
    );
    if (maxMessageId > 0) {
      this.#setReadPosition(chatId, maxMessageId);
    }
    this.#setUnreadCount(chatId, 0);
  }

  #isMessageAlreadyRead(chatId, messageId) {
    const id = Number(messageId);
    if (!Number.isFinite(id) || id <= 0) {
      return false;
    }
    return id <= Number(this.readPositions.get(String(chatId)) || 0);
  }

  #incrementUnreadCount(chatId, messageId = null) {
    const key = String(chatId);
    const messageKey = messageId === null || messageId === undefined ? '' : String(messageId);

    if (messageKey) {
      let ids = this.unreadMessageIds.get(key);
      if (!ids) {
        ids = new Set();
        this.unreadMessageIds.set(key, ids);
      }
      if (ids.has(messageKey)) {
        return;
      }
      ids.add(messageKey);
    }

    this.#setUnreadCount(chatId, (this.unreadCounts.get(key) || 0) + 1);
  }

  #setUnreadCount(chatId, count) {
    if (!chatId) {
      return;
    }

    const key = String(chatId);
    const normalized = Math.max(0, Math.floor(Number(count) || 0));
    if (normalized > 0) {
      this.unreadCounts.set(key, normalized);
    } else {
      this.unreadCounts.delete(key);
      this.unreadMessageIds.delete(key);
    }

    const chat = this.chats.find((item) => String(item.chatId) === key);
    if (chat) {
      chat.unreadCount = normalized;
    }

    this.ui.setChatUnreadCount?.(chatId, normalized);
    this.chatListSignature = this.#chatsSignature(this.chats);
    this.#saveUnreadCounts();
  }

  #messagesSignature(messages) {
    return JSON.stringify((messages || []).map((message) => [
      message.messageId,
      message.senderId,
      message.createdAt,
      message.encryptionName,
      message.messageB64
    ]));
  }

  #memberIds(chat) {
    const participantIds = (chat?.participants || [])
      .map((item) => item.userId)
      .filter(Boolean);
    if (participantIds.length > 0) {
      return participantIds;
    }
    return [this.userId];
  }

  async #requestMissingSenderKeyForRealtimeMessage(payload, ws) {
    const message = payload?.payload?.message;
    await this.#requestMissingSenderKeyForMessage({
      chatId: message?.chat?.chatId || message?.chatId,
      messageId: message?.messageId || null,
      senderId: message?.senderId,
      encryptionName: message?.encryptionName || message?.encryptName
    }, ws);
  }

  #trackUnreadFromRealtime(payload) {
    const message = payload?.payload?.message || payload?.message || {};
    const chatId = message?.chat?.chatId
      || message?.chatId
      || payload?.payload?.chat?.chatId
      || payload?.payload?.chatId
      || payload?.chatId;
    const senderId = message?.senderId || payload?.payload?.senderId || payload?.senderId;
    const messageId = message?.messageId || payload?.payload?.messageId || payload?.messageId;

    if (!chatId || !senderId) {
      return;
    }
    if (String(senderId) === String(this.userId)) {
      return;
    }
    if (Number(chatId) === Number(this.activeChatId)) {
      return;
    }
    if (this.#isMessageAlreadyRead(chatId, messageId)) {
      return;
    }

    this.#incrementUnreadCount(chatId, messageId);
  }

  #trackUnreadFromUserSync(payload) {
    const messages = payload?.payload?.messages;
    if (!Array.isArray(messages)) {
      return;
    }

    messages.forEach((message) => {
      const chatId = message?.chat?.chatId || message?.chatId;
      const senderId = message?.senderId;
      const messageId = message?.messageId;

      if (!chatId || !senderId) {
        return;
      }
      if (String(senderId) === String(this.userId)) {
        return;
      }
      if (Number(chatId) === Number(this.activeChatId)) {
        return;
      }
      if (this.#isMessageAlreadyRead(chatId, messageId)) {
        return;
      }

      this.#incrementUnreadCount(chatId, messageId);
    });
  }

  async #requestMissingSenderKeyForMessage(message, ws) {
    const chatId = message?.chat?.chatId || message?.chatId;
    const messageId = message?.messageId || null;
    const senderId = message?.senderId;
    const encryptName = message?.encryptionName || message?.encryptName;

    if (!ws || !chatId || !senderId || !encryptName || String(senderId) === String(this.userId)) {
      return;
    }

    if (await this.keyManager.hasSenderKey(encryptName)) {
      return;
    }

    const requestId = [chatId, encryptName, senderId].map(String).join(':');
    if (this.requestedMessageKeys.has(requestId)) {
      return;
    }

    const sent = ws.requestMessageKey({
      chatId,
      messageId,
      senderId,
      encryptName
    });

    if (sent) {
      this.requestedMessageKeys.add(requestId);
      this.ui.appendStatus('Requested a key for the new message. It will appear after the key arrives.', 'info');
    }
  }

  async #answerMessageKeyRequest(payload) {
    const request = payload?.payload;
    const chatId = request?.chatId;
    const requesterId = request?.requesterId;
    const senderId = request?.senderId;
    const encryptName = request?.encryptName;

    if (!chatId || !requesterId || !encryptName || String(senderId) !== String(this.userId)) {
      return;
    }

    await this.#safeShareSenderKeyByEncryptNameWithUsers(chatId, encryptName, [requesterId]);
  }

  async #safeShareAllSenderKeysForChatWithUsers(chatId, userIds) {
    try {
      return await this.keyManager.shareAllSenderKeysForChatWithUsers(chatId, userIds);
    } catch (error) {
      this.ui.appendStatus(`Failed to send sender keys to the new member: ${error.message}`, 'info');
      return { sent: 0, failed: Array.isArray(userIds) ? userIds.length : 0, skipped: 0 };
    }
  }

  async #safeShareSenderKeyByEncryptNameWithUsers(chatId, encryptName, userIds) {
    try {
      return await this.keyManager.shareSenderKeyByEncryptNameWithUsers(chatId, encryptName, userIds);
    } catch (error) {
      this.ui.appendStatus(`Failed to send sender key by request: ${error.message}`, 'info');
      return { sent: 0, failed: Array.isArray(userIds) ? userIds.length : 0, skipped: 0 };
    }
  }
}
