import { ApiClient } from './api.js';
import { ChatManager } from './chat-manager.js';
import { CryptoEngine } from './crypto.js';
import { FrontendDb } from './db.js';
import { KeyManager } from './key-manager.js';
import { SettingsManager } from './settings-manager.js';
import { SettingsUi } from './settings-ui.js';
import { ChatUi } from './ui.js';
import { WsManager } from './ws.js';

const api = new ApiClient();
const db = new FrontendDb();
const crypto = new CryptoEngine();
const ui = new ChatUi();
const settingsUi = new SettingsUi();
const keyManager = new KeyManager({ api, db, crypto, ui });
const chatManager = new ChatManager({ api, ui, keyManager });
const settingsManager = new SettingsManager({ api, ui, settingsUi, keyManager });

let userId = null;
let ws = null;

void start();

async function start() {
  try {
    await db.init();
    userId = await api.getCurrentUserId();
    userId = String(userId || '').replace(/^"|"$/g, '');
    if (!userId) {
      throw new Error('Не удалось определить текущую сессию. Войдите еще раз.');
    }

    ui.setUserId(userId);
    ui.renderActiveChat(null);
    chatManager.init(userId);
    await keyManager.init(userId);
    await settingsManager.init(userId);
    bindUi();
    await stepBootstrapKeys();
    await settingsManager.refreshDiagnostics();
    await stepChats();
    stepWebSocket();
    ui.appendStatus('Интерфейс готов. Можно искать чаты и общаться.', 'ok');
  } catch (error) {
    ui.appendStatus(error.message || 'Не удалось инициализировать приложение.', 'error');
  }
}

function bindUi() {
  ui.bind({
    onOpenSettings: async (tabName) => {
      await runAction(async () => {
        await settingsManager.open(tabName);
      });
    },
    onExitSearch: () => {
      ui.setSearchMode(false);
      ui.clearSearchResults();
    },
    onLogout: async () => {
      await runAction(async () => {
        try {
          await api.logout();
        } finally {
          if (ws) {
            ws.disconnect();
          }
          window.location.href = '/auth/login';
        }
      });
    },
    onReload: () => window.location.reload(),
    onBootstrapKeys: async () => {
      await runAction(async () => {
        await stepBootstrapKeys();
        ui.appendStatus('Ключи синхронизированы повторно.', 'ok');
      });
    },
    onSearchUser: async () => {
      await runAction(async () => {
        const query = ui.nodes.searchInput.value;
        const results = await chatManager.searchDialogs(query);
        ui.renderSearchResults(results, async (result) => {
          await runAction(async () => {
            await chatManager.openSearchResult(result);
            ui.setSearchMode(false);
            ui.clearSearchResults();
          });
        });
      });
    },
    onSendMessage: async () => {
      await runAction(async () => {
        const text = ui.nodes.messageInput.value;
        const imported = await keyManager.ingestPendingMessageKeys();
        if (imported.importedCount > 0 && chatManager.activeChatId) {
          await chatManager.refreshVisibleMessages(chatManager.activeChatId);
        }
        await keyManager.retryFailedSenderKeyDeliveries();
        await chatManager.sendMessage(text);
        ui.nodes.messageInput.value = '';
        ui.appendStatus('Сообщение отправлено.', 'ok');
      });
    },
    onCreateGroupChat: async () => {
      await runAction(async () => {
        const title = ui.nodes.groupTitleInput.value;
        await chatManager.createGroupChat(title);
        ui.nodes.groupTitleInput.value = '';
        settingsUi.setStatus('Групповой чат создан.', 'ok');
        ui.appendStatus('Групповой чат создан.', 'ok');
      });
    },
    onCreateGroupChatModal: async () => {
      await runAction(async () => {
        const title = ui.nodes.createChatTitleInput.value;
        await chatManager.createGroupChat(title);
        ui.nodes.createChatTitleInput.value = '';
        ui.closeCreateChatModal();
        ui.appendStatus('Групповой чат создан.', 'ok');
      });
    },
    onWsReconnect: () => {
      void runAction(async () => {
        if (ws) {
          ws.connect(chatManager.chats.map((chat) => chat.chatId));
        }
        ui.appendStatus('Переподключение websocket запущено.', 'info');
      });
    },
    onMemberAction: async (action) => {
      await runAction(async () => {
        const username = ui.nodes.memberInput.value;
        await chatManager.memberAction(action, username);
        ui.nodes.memberInput.value = '';
        ui.appendStatus(`Действие с участником выполнено: ${action}.`, 'ok');
      });
    },
    onToggleChatMenu: () => {
      const chat = chatManager.activeChat;
      if (!chat) {
        return;
      }

      if (!ui.nodes.chatMenu.hidden) {
        ui.hideChatMenu();
        return;
      }

      const items = [
        {
          label: 'Открыть участников',
          onClick: () => {
            ui.setOptionsPanelOpen(true);
            ui.renderMembers(chat.participants || [], chat);
          }
        }
      ];

      if (chat.chatType === 'PERSONAL') {
        items.push({
          label: 'Заблокировать пользователя',
          danger: true,
          onClick: () => {
            void runAction(async () => {
              await chatManager.memberAction('block', '');
              ui.appendStatus('Пользователь заблокирован в этом диалоге.', 'ok');
            });
          }
        });
      } else {
        if (chat.canManageMembers) {
          items.push(
            {
              label: 'Добавить участника',
              onClick: () => {
                ui.setOptionsPanelOpen(true);
                ui.nodes.memberInput.placeholder = 'Username для добавления';
                ui.nodes.memberInput.focus();
              }
            },
            {
              label: 'Удалить участника',
              onClick: () => {
                ui.setOptionsPanelOpen(true);
                ui.nodes.memberInput.placeholder = 'Username для удаления';
                ui.nodes.memberInput.focus();
              }
            },
            {
              label: 'Заблокировать участника',
              onClick: () => {
                ui.setOptionsPanelOpen(true);
                ui.nodes.memberInput.placeholder = 'Username для блокировки';
                ui.nodes.memberInput.focus();
              }
            }
          );
        }

        if (chat.canDeleteChat) {
          items.push({
            label: 'Удалить группу',
            danger: true,
            onClick: () => {
              void runAction(async () => {
                await chatManager.deleteActiveChat();
                ui.appendStatus('Группа удалена.', 'ok');
              });
            }
          });
        }
      }

      ui.renderChatMenu(items);
    },
    onMessageContext: ({ x, y, payload }) => {
      const visibleMessages = chatManager.messagesByChat.get(String(chatManager.activeChatId)) || [];
      const message = visibleMessages.find((item) => Number(item.messageId) === Number(payload.messageId));
      if (!chatManager.canDeleteMessage(message)) {
        ui.hideMessageMenu();
        return;
      }

      ui.renderMessageMenu(x, y, [{
        label: 'Удалить сообщение',
        danger: true,
        onClick: () => {
          void runAction(async () => {
            await chatManager.deleteMessage(payload.messageId);
            ui.appendStatus('Сообщение удалено.', 'ok');
          });
        }
      }], payload);
    }
  });

  settingsUi.bind({
    onOpen: async () => { await runAction(async () => { await settingsManager.open(); }); },
    onClose: () => settingsManager.close(),
    onTabChange: (tabName) => settingsManager.setTab(tabName),
    onSaveProfile: async () => { await runAction(async () => { await settingsManager.saveProfile(); }); },
    onSavePreferences: async () => { await runAction(async () => { await settingsManager.savePreferences(); }); },
    onClearAutoDelete: () => {
      settingsUi.clearAutoDelete();
      settingsUi.setStatus('Дата автоудаления очищена. Не забудьте сохранить изменения.', 'info');
    },
    onChangePassword: async () => { await runAction(async () => { await settingsManager.changePassword(); }); },
    onRotateKeys: async () => { await runAction(async () => { await settingsManager.rotateKeys(); }); },
    onRotateSessionKeys: async () => { await runAction(async () => { await settingsManager.rotateSessionKeys(); }); },
    onLogoutAll: async () => { await runAction(async () => { await settingsManager.logoutAll(); }); }
  });
}

async function stepBootstrapKeys() {
  ui.appendStatus('Проверяю и синхронизирую ключи пользователя...', 'info');
  await keyManager.bootstrap();
  const imported = await keyManager.ingestPendingMessageKeys();
  if (imported.importedCount > 0 && chatManager.activeChatId) {
    await chatManager.refreshVisibleMessages(chatManager.activeChatId);
  }
  await keyManager.retryFailedSenderKeyDeliveries();
  await settingsManager.refreshDiagnostics();
}

async function stepChats() {
  ui.appendStatus('Загружаю список чатов...', 'info');
  await chatManager.refreshChats();
}

function stepWebSocket() {
  ui.appendStatus('Запускаю realtime-синхронизацию...', 'info');
  ws = new WsManager({
    ui,
    onMessage: async (rawBody) => {
      try {
        if (!rawBody) {
          return;
        }
        const imported = await keyManager.ingestPendingMessageKeys();
        const payload = JSON.parse(rawBody);
        await chatManager.handleRealtimeEvent(payload, ws);
        await keyManager.retryFailedSenderKeyDeliveries();
        if (imported.importedCount > 0 && chatManager.activeChatId) {
          await chatManager.refreshVisibleMessages(chatManager.activeChatId);
        }
        if (chatManager.activeChatId) {
          await chatManager.loadMessages(chatManager.activeChatId);
        }
        await chatManager.refreshChats();
        syncWsChats();
        if (payload?.type) {
          ui.appendStatus(`Пришло realtime-событие: ${payload.type}`, 'info');
        }
      } catch (error) {
        ui.appendStatus(`Не удалось обработать realtime-событие: ${error.message}`, 'error');
      }
    }
  });
  chatManager.setWebSocket(ws);
  ws.connect(chatManager.chats.map((chat) => chat.chatId));
}

function syncWsChats() {
  if (ws) {
    ws.syncChats(chatManager.chats.map((chat) => chat.chatId));
  }
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    const message = error?.message || 'Ошибка операции.';
    ui.appendStatus(message, 'error');
    settingsUi.setStatus(message, 'error');
  }
}
