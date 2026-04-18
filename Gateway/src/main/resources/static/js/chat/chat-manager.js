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
    this.messagesByChat = new Map();
    this.membersByChat = new Map();
  }

  init(userId) {
    this.userId = userId;
  }

  async refreshChats() {
    const payload = await this.api.getChats();
    this.chats = Array.isArray(payload) ? payload : [];
    this.ui.renderChats(this.chats, this.activeChatId, (chatId) => {
      this.openChat(chatId).catch((error) => this.ui.appendStatus(error.message, 'error'));
    });
  }

  async openChat(chatId) {
    this.activeChatId = Number(chatId);
    const chat = this.chats.find((item) => Number(item.chatId) === this.activeChatId);
    this.ui.setChatTitle(chat?.title || `Чат #${chatId}`);
    await Promise.all([this.loadMessages(chatId), this.loadMembers(chatId)]);
    await this.refreshChats();
  }

  async loadMessages(chatId) {
    const payload = await this.api.getMessages(chatId, LIMITS.defaultMessagePageSize);
    const rows = Array.isArray(payload) ? payload : [];
    const mapped = [];

    for (const row of rows) {
      mapped.push({
        messageId: row.messageId,
        senderId: row.senderId,
        chatId: row.chatId || row.chat?.chatId || chatId,
        encryptionName: row.encryptionName || row.encryptName || null,
        messageB64: normalizeBase64(row.message) || '',
        text: await this.keyManager.decryptMessage(normalizeBase64(row.message) || '', row.encryptionName || row.encryptName || null)
      });
    }

    this.messagesByChat.set(String(chatId), mapped);
    if (Number(chatId) === this.activeChatId) {
      this.ui.renderMessages(mapped, this.userId);
    }
  }

  async sendMessage(text) {
    if (!this.activeChatId) {
      throw new Error('Сначала выберите чат.');
    }
    const clean = String(text || '').trim();
    if (!clean) {
      throw new Error('Введите текст сообщения.');
    }

    const members = await this.loadMembers(this.activeChatId);
    const senderKey = await this.keyManager.ensureSenderKey(this.activeChatId, members);
    const encrypted = await this.keyManager.crypto.encryptMessage(clean, senderKey.keyB64);

    const created = await this.api.sendMessage({
      chatId: this.activeChatId,
      message: encrypted,
      encryptionName: senderKey.encryptName
    });

    await this.keyManager.incrementUsage(this.activeChatId, senderKey.encryptName);

    const current = this.messagesByChat.get(String(this.activeChatId)) || [];
    current.push({
      messageId: created.messageId,
      senderId: this.userId,
      chatId: this.activeChatId,
      encryptionName: senderKey.encryptName,
      messageB64: encrypted,
      text: clean
    });
    this.messagesByChat.set(String(this.activeChatId), current);
    this.ui.renderMessages(current, this.userId);
  }

  async searchAndPreparePersonalChat(username) {
    const clean = String(username || '').trim();
    if (!clean) {
      throw new Error('Введите username.');
    }

    const result = await this.api.searchUsers(clean);
    const rows = Array.isArray(result) ? result : [];
    if (rows.length === 0) {
      return null;
    }
    return rows[0];
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

  async loadMembers(chatId) {
    if (!chatId) return [];
    const payload = await this.api.getChatMembers(chatId);
    const users = Array.isArray(payload) ? payload.map((item) => String(item)) : [];
    this.membersByChat.set(String(chatId), users);
    if (Number(chatId) === this.activeChatId) {
      this.ui.renderMembers(users);
    }
    return users;
  }

  async memberAction(action, username) {
    if (!this.activeChatId) {
      throw new Error('Сначала выберите чат.');
    }
    const clean = String(username || '').trim();
    if (!clean) {
      throw new Error('Введите username участника.');
    }
    const userTarget = await this.api.getIdByUsername(clean);
    if (!userTarget) {
      throw new Error('Не найден userId для username.');
    }

    if (action === 'add') {
      await this.api.addUserInChat(this.activeChatId, userTarget);
    } else if (action === 'remove') {
      await this.api.removeUserInChat(this.activeChatId, userTarget);
    } else if (action === 'block') {
      await this.api.blockUserInChat(this.activeChatId, userTarget);
    }

    await this.loadMembers(this.activeChatId);
  }
}
