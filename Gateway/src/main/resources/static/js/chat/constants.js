export const API = {
  me: '/api/getId',
  settings: '/api/settings',
  settingsUsername: '/api/settings/profile/username',
  settingsAvatarUrl: '/api/settings/profile/avatar-url',
  settingsAllowWriting: '/api/settings/preferences/allow-writing',
  settingsAllowAddChat: '/api/settings/preferences/allow-add-chat',
  settingsAutoDeleteMessage: '/api/settings/preferences/auto-delete-message',
  settingsChangePassword: '/api/settings/security/change-password',
  settingsLogoutAll: '/api/settings/security/logout-all',
  chats: '/api/chats',
  sidebarChats: '/api/sidebar/chats',
  searchUsers: '/api/search_by_username',
  getIdByUsername: (username) => `/api/${encodeURIComponent(username)}/getId`,
  chatMembers: (chatId) => `/api/chats/${chatId}/members`,
  chatMessages: (chatId, limit = 50) => `/api/messages/${chatId}?limit=${limit}`,
  createPersonalChat: '/api/personal_chat',
  createGroupChat: '/api/group_chat',
  deleteChat: (chatId) => `/api/chats/${chatId}`,
  addUserToChat: '/api/add_user_in_chat',
  removeUserFromChat: '/api/delete_user_in_chat',
  blockUserInChat: '/api/block_user',
  sendMessage: '/api/sendMessage',
  deleteMessage: '/api/delete',
  ownPublicKey: '/api/encrypt_key/',
  savePublicKey: '/api/encrypt_key/new_key',
  getPublicKeysByUsers: '/api/encrypt_key/byUserIdIn',
  getPublicKeysByIds: '/api/encrypt_key/byIds',
  getNewPrivateKey: '/api/encrypt_key/new_private_key',
  getNewPrivateKeyChain: '/api/encrypt_key/new_private_key/all',
  saveNewPrivateKey: '/api/encrypt_key/new_private_key',
  getPendingMessageKeys: '/api/encrypt_message_key/pending',
  sendMessageKeys: '/api/encrypt_message_key/send',
  deletePendingMessageKey: '/api/encrypt_message_key/delete',
  latestKeyUsage: (chatId) => `/api/key-usage/chats/${chatId}/latest`
};

export const WS = {
  endpoint: '/ws',
  userDestination: '/user/queue/events',
  chatPrefix: '/topic/chat/'
};

export const LIMITS = {
  maxMessagesPerSenderKey: 100,
  defaultMessagePageSize: 50
};

export const DB_NAME = 'mescat_frontend_v2';
export const DB_VERSION = 1;

export const STORE = {
  userKeys: 'user_keys',
  senderKeys: 'sender_keys',
  usage: 'sender_usage'
};
