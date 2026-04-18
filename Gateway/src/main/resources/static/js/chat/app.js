import { ApiClient } from './api.js';
import { ChatManager } from './chat-manager.js';
import { CryptoEngine } from './crypto.js';
import { FrontendDb } from './db.js';
import { KeyManager } from './key-manager.js';
import { ChatUi } from './ui.js';
import { WsManager } from './ws.js';

const api = new ApiClient();
const db = new FrontendDb();
const crypto = new CryptoEngine();
const ui = new ChatUi();
const keyManager = new KeyManager({ api, db, crypto, ui });
const chatManager = new ChatManager({ api, ui, keyManager });

let userId = null;
let ws = null;

void start();

async function start() {
  try {
    await db.init();
    userId = await api.getCurrentUserId();
    userId = String(userId || '').replace(/^"|"$/g, '');

    if (!userId) {
      throw new Error('Не удалось получить userId текущей сессии.');
    }

    ui.setUserId(userId);
    chatManager.init(userId);
    await keyManager.init(userId);

    bindUi();

    await stepBootstrapKeys();
    await stepChats();
    stepWebSocket();

    ui.appendStatus('Приложение готово к работе.', 'ok');
  } catch (error) {
    ui.appendStatus(error.message || 'Ошибка инициализации приложения.', 'error');
  }
}

function bindUi() {
  ui.bind({
    onLogout: async () => {
      try {
        await api.logout();
      } finally {
        if (ws) {
          ws.disconnect();
        }
        window.location.href = '/auth/login';
      }
    },
    onReload: () => window.location.reload(),
    onBootstrapKeys: async () => {
      await stepBootstrapKeys();
      ui.appendStatus('Шаг ключей выполнен повторно.', 'ok');
    },
    onSearchUser: async () => {
      const username = ui.nodes.searchInput.value;
      const first = await chatManager.searchAndPreparePersonalChat(username);
      const action = ui.renderSearchResult(first);
      if (action && first) {
        action.addEventListener('click', async () => {
          await chatManager.createPersonalChatByUsername(first.title);
          ui.appendStatus('Личный чат создан/открыт.', 'ok');
          syncWsChats();
        }, { once: true });
      }
    },
    onRefreshChats: async () => {
      await chatManager.refreshChats();
      ui.appendStatus('Список чатов обновлён.', 'ok');
      syncWsChats();
    },
    onSendMessage: async () => {
      const text = ui.nodes.messageInput.value;
      await keyManager.ingestPendingMessageKeys();
      await chatManager.sendMessage(text);
      ui.nodes.messageInput.value = '';
      ui.appendStatus('Сообщение отправлено.', 'ok');
    },
    onCreateGroupChat: async () => {
      const title = ui.nodes.groupTitleInput.value;
      await chatManager.createGroupChat(title);
      ui.nodes.groupTitleInput.value = '';
      ui.appendStatus('Групповой чат создан.', 'ok');
      syncWsChats();
    },
    onWsReconnect: () => {
      if (ws) {
        ws.connect(chatManager.chats.map((chat) => chat.chatId));
      }
      ui.appendStatus('Повторное подключение WS запущено.', 'info');
    },
    onMemberAction: async (action) => {
      const username = ui.nodes.memberInput.value;
      await chatManager.memberAction(action, username);
      ui.appendStatus(`Действие с участником выполнено: ${action}.`, 'ok');
      ui.nodes.memberInput.value = '';
    }
  });
}

async function stepBootstrapKeys() {
  ui.appendStatus('Шаг 1: проверка и синхронизация user-ключей...', 'info');
  await keyManager.bootstrap();
  await keyManager.ingestPendingMessageKeys();
}

async function stepChats() {
  ui.appendStatus('Шаг 2: загрузка чатов и сообщений...', 'info');
  await chatManager.refreshChats();
  if (chatManager.chats.length > 0) {
    await chatManager.openChat(chatManager.chats[0].chatId);
  }
}

function stepWebSocket() {
  ui.appendStatus('Шаг 3: запуск realtime websocket...', 'info');
  ws = new WsManager({
    ui,
    onMessage: async (rawBody) => {
      try {
        if (!rawBody) return;
        const payload = JSON.parse(rawBody);
        await keyManager.ingestPendingMessageKeys();

        if (chatManager.activeChatId) {
          await chatManager.loadMessages(chatManager.activeChatId);
        }
        await chatManager.refreshChats();
        syncWsChats();

        if (payload?.type) {
          ui.appendStatus(`Realtime событие: ${payload.type}`, 'info');
        }
      } catch (error) {
        ui.appendStatus(`Ошибка обработки realtime: ${error.message}`, 'error');
      }
    }
  });
  ws.connect(chatManager.chats.map((chat) => chat.chatId));
}

function syncWsChats() {
  if (ws) {
    ws.syncChats(chatManager.chats.map((chat) => chat.chatId));
  }
}
