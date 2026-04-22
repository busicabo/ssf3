import { LIMITS } from './constants.js';
import { normalizeBase64 } from './base64.js';


export class ChatManager {
  constructor({ api, ui, keyManager }) {
    this.api = api;
    this.ui = ui;
    this.keyManager = keyManager;
    this.userId = null;
    this.chats = [];
    this.activeChatId = null;
    this.rawMessagesByChat = new Map();
    this.messagesByChat = new Map();
    this.requestedMessageKeys = new Set();
    this.ws = null;
  }

  init(userId) {
    this.userId = userId;
  }

  setWebSocket(ws) {
    this.ws = ws;
  }

  get activeChat() {
    return this.chats.find((item) => Number(item.chatId) === Number(this.activeChatId)) || null;
  }

  async refreshChats() {
    const payload = await this.api.getSidebarChats();
    const rows = Array.isArray(payload) ? payload : [];
    const nextChats = [];

    for (const row of rows) {
      nextChats.push(await this.#normalizeChat(row));
    }
    this.chats = nextChats;
    this.ui.renderChats(this.chats, this.activeChatId, (chatId) => {
      this.openChat(chatId).catch((error) => this.ui.appendStatus(error.message, 'error'));
    });

    if (this.activeChatId) {
      const active = this.activeChat;
      if (active) {
        this.ui.renderActiveChat(active);
        this.ui.renderMembers(active.participants || [], active);
      } else {
        this.activeChatId = null;
        this.ui.renderActiveChat(null);
        this.ui.renderMessages([], this.userId, null);
      }
    }
  }

  async openChat(chatId) {
    this.activeChatId = Number(chatId);
    this.ui.setActiveChatInList(this.activeChatId);
    const chat = this.activeChat;
    this.ui.renderActiveChat(chat);
    this.ui.renderMembers(chat?.participants || [], chat);
    await this.keyManager.ingestPendingMessageKeys();
    await this.loadMessages(chatId);
  }

  async loadMessages(chatId) {
    const payload = await this.api.getMessages(chatId, LIMITS.defaultMessagePageSize);
    const rows = Array.isArray(payload) ? payload : [];
    this.rawMessagesByChat.set(String(chatId), rows.map((row) => ({
      messageId: row.messageId,
      senderId: row.senderId,
      senderUsername: row.senderUsername || row.sender?.username || null,
      senderAvatarUrl: row.senderAvatarUrl || row.sender?.avatarUrl || null,
      createdAt: row.createdAt || null,
      chatId: row.chatId || row.chat?.chatId || chatId,
      encryptionName: row.encryptionName || row.encryptName || null,
      messageB64: normalizeBase64(row.message) || ''
    })));
    await this.refreshVisibleMessages(chatId);
  }

  async refreshVisibleMessages(chatId = this.activeChatId) {
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
      this.ui.renderMessages(visibleMessages, this.userId, this.activeChat);
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

    const members = this.#memberIds(this.activeChat);
    const senderKey = await this.keyManager.ensureSenderKey(this.activeChatId, members);
    const encrypted = await this.keyManager.crypto.encryptMessage(clean, senderKey.keyB64);

    const created = await this.api.sendMessage({
      chatId: this.activeChatId,
      message: encrypted,
      encryptionName: senderKey.encryptName
    });

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
    this.ui.renderMessages(current, this.userId, this.activeChat);
    await this.refreshChats();
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
    this.messagesByChat.set(String(this.activeChatId), visibleRows);
    this.ui.renderMessages(visibleRows, this.userId, this.activeChat);
    await this.refreshChats();
  }

  async deleteActiveChat() {
    if (!this.activeChatId) {
      throw new Error('Сначала выберите чат.');
    }

    await this.api.deleteChat(this.activeChatId);
    this.rawMessagesByChat.delete(String(this.activeChatId));
    this.messagesByChat.delete(String(this.activeChatId));
    this.activeChatId = null;
    this.ui.renderActiveChat(null);
    this.ui.renderMessages([], this.userId, null);
    await this.refreshChats();
  }

  async searchDialogs(query) {
    const clean = String(query || '').trim();
    if (!clean) {
      throw new Error('Введите запрос для поиска.');
    }

    const normalized = this.#normalizeSearch(clean);
    const localMatches = this.chats
      .filter((chat) => this.#matchesChat(chat, normalized))
      .map((chat) => ({ ...chat, kind: 'existing-chat' }));

    const remote = await this.api.searchUsers(clean);
    const remoteRows = (Array.isArray(remote) ? remote : [])
      .filter((row) => this.#matchesRemoteRow(row, normalized));
    const seenChatIds = new Set(localMatches.map((chat) => Number(chat.chatId)));
    const seenTitles = new Set(localMatches.map((chat) => (chat.title || '').toLowerCase()));

    remoteRows.forEach((row) => {
      if (row?.chatId && !seenChatIds.has(Number(row.chatId))) {
        localMatches.push({
          chatId: row.chatId,
          chatType: this.#normalizeChatType(row.chatType),
          title: row.title,
          avatarUrl: row.avatarUrl || '',
          previewText: '',
          counterpartOnline: false,
          memberCount: 2,
          onlineCount: 0,
          participants: [],
          kind: 'existing-chat'
        });
        seenChatIds.add(Number(row.chatId));
        seenTitles.add((row.title || '').toLowerCase());
      }
    });

    const usersWithoutChat = remoteRows
      .filter((row) => !row?.chatId)
      .filter((row) => !seenTitles.has((row.title || '').toLowerCase()))
      .map((row) => ({
        chatId: null,
        chatType: 'PERSONAL',
        title: row.title,
        avatarUrl: row.avatarUrl || '',
        counterpartUserId: null,
        counterpartOnline: false,
        memberCount: 1,
        onlineCount: 0,
        participants: [],
        previewText: 'Нажмите, чтобы открыть личный диалог.',
        kind: 'user'
      }));

    return [...localMatches, ...usersWithoutChat];
  }

  async openSearchResult(result) {
    if (!result) {
      return;
    }

    if (result.chatId) {
      if (!this.chats.find((chat) => Number(chat.chatId) === Number(result.chatId))) {
        await this.refreshChats();
      }
      await this.openChat(result.chatId);
      return;
    }

    await this.createPersonalChatByUsername(result.title);
  }

  async createPersonalChatByUsername(username) {
    const userId = await this.api.getIdByUsername(username);
    const created = await this.api.createPersonalChat(userId);
    if (!created?.chatId) {
      throw new Error('Сервер не вернул chatId личного чата.');
    }
    await this.refreshChats();
    await this.openChat(created.chatId);
  }

  async createGroupChat(title) {
    const clean = String(title || '').trim();
    if (!clean) {
      throw new Error('Введите название группы.');
    }

    const created = await this.api.createGroupChat(clean, '');
    await this.refreshChats();
    if (created?.chatId) {
      await this.openChat(created.chatId);
    }
  }

  async memberAction(action, username) {
    const chat = this.activeChat;
    if (!chat?.chatId) {
      throw new Error('Сначала выберите чат.');
    }

    let userTarget = null;
    const clean = String(username || '').trim();

    if (chat.chatType === 'PERSONAL' && action === 'block') {
      userTarget = chat.counterpartUserId;
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
    }

    await this.refreshChats();
    if (this.activeChatId) {
      this.ui.renderMembers(this.activeChat?.participants || [], this.activeChat);
    }
  }

  async handleRealtimeEvent(payload, ws = null) {
    const type = String(payload?.type || '').toUpperCase();
    if (type === 'SEND') {
      await this.#requestMissingSenderKeyForRealtimeMessage(payload, ws);
    }
    if (type === 'MESSAGE_KEY_REQUEST') {
      await this.#answerMessageKeyRequest(payload);
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

  async #normalizeChat(row) {
    const chatType = this.#normalizeChatType(row.chatType);
    const participants = this.#normalizeParticipants(row.participants);
    const previewText = await this.#decryptPreview(row.lastMessage, row.encryptName);
    return {
      chatId: row.chatId,
      chatType,
      title: row.title || `Чат #${row.chatId}`,
      avatarUrl: row.avatarUrl || this.#fallbackAvatar(chatType, participants),
      previewText,
      counterpartUserId: row.counterpartUserId || null,
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
    try {
      return await this.keyManager.decryptMessage(messageB64, encryptName) || '';
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

  #matchesChat(chat, query) {
    if (!query) {
      return false;
    }

    if (chat.chatType === 'GROUP') {
      return this.#normalizeSearch(chat.title).includes(query);
    }

    const usernames = [
      chat.title,
      ...(chat.memberUsernames || []),
      ...(chat.participants || [])
        .filter((item) => String(item.userId) !== String(this.userId))
        .map((item) => item.username)
    ];

    return usernames.some((value) => this.#normalizeSearch(value).includes(query));
  }

  #matchesRemoteRow(row, query) {
    if (!row || !query) {
      return false;
    }

    const chatType = this.#normalizeChatType(row.chatType);
    if (row.chatId && chatType === 'GROUP') {
      return this.#normalizeSearch(row.title || row.groupTitle || row.name).includes(query);
    }

    return this.#normalizeSearch(row.username || row.title || row.name).includes(query);
  }

  #normalizeSearch(value) {
    return String(value || '').trim().toLocaleLowerCase('ru-RU');
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
