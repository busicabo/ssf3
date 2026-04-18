export const API = {
  me: '/api/getId',
  chats: '/api/chats',
  searchUsers: '/api/search_by_username',
  getIdByUsername: (username) => `/api/${encodeURIComponent(username)}/getId`,
  chatMembers: (chatId) => `/api/chats/${chatId}/members`,
  chatMessages: (chatId, limit = 50) => `/api/messages/${chatId}?limit=${limit}`,
  createPersonalChat: '/api/personal_chat',
  createGroupChat: '/api/group_chat',
  addUserToChat: '/api/add_user_in_chat',
  removeUserFromChat: '/api/delete_user_in_chat',
  blockUserInChat: '/api/block_user',
  sendMessage: '/api/sendMessage',
  ownPublicKey: '/api/encrypt_key/',
  savePublicKey: '/api/encrypt_key/new_key',
  getPublicKeysByUsers: '/api/encrypt_key/byUserIdIn',
  getPublicKeysByIds: '/api/encrypt_key/byIds',
  getNewPrivateKey: '/api/encrypt_key/new_private_key',
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
