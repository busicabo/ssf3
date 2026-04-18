export class ChatUi {
  constructor() {
    this.nodes = {
      userId: document.getElementById('userId'),
      wsState: document.getElementById('wsState'),
      keyState: document.getElementById('keyState'),
      statusList: document.getElementById('statusList'),
      chats: document.getElementById('chatList'),
      chatTitle: document.getElementById('chatTitle'),
      messageList: document.getElementById('messageList'),
      searchInput: document.getElementById('searchInput'),
      searchBtn: document.getElementById('searchBtn'),
      searchResult: document.getElementById('searchResult'),
      groupTitleInput: document.getElementById('groupTitleInput'),
      createGroupBtn: document.getElementById('createGroupBtn'),
      refreshChatsBtn: document.getElementById('refreshChatsBtn'),
      messageInput: document.getElementById('messageInput'),
      sendBtn: document.getElementById('sendBtn'),
      logoutBtn: document.getElementById('logoutBtn'),
      reloadBtn: document.getElementById('reloadBtn'),
      bootstrapKeysBtn: document.getElementById('bootstrapKeysBtn'),
      wsReconnectBtn: document.getElementById('wsReconnectBtn'),
      membersList: document.getElementById('membersList'),
      memberInput: document.getElementById('memberInput'),
      addMemberBtn: document.getElementById('addMemberBtn'),
      removeMemberBtn: document.getElementById('removeMemberBtn'),
      blockMemberBtn: document.getElementById('blockMemberBtn')
    };
  }

  bind(events) {
    this.nodes.logoutBtn.addEventListener('click', events.onLogout);
    this.nodes.reloadBtn.addEventListener('click', events.onReload);
    this.nodes.bootstrapKeysBtn.addEventListener('click', events.onBootstrapKeys);
    this.nodes.searchBtn.addEventListener('click', events.onSearchUser);
    this.nodes.refreshChatsBtn.addEventListener('click', events.onRefreshChats);
    this.nodes.sendBtn.addEventListener('click', events.onSendMessage);
    this.nodes.createGroupBtn.addEventListener('click', events.onCreateGroupChat);
    this.nodes.wsReconnectBtn.addEventListener('click', events.onWsReconnect);
    this.nodes.addMemberBtn.addEventListener('click', () => events.onMemberAction('add'));
    this.nodes.removeMemberBtn.addEventListener('click', () => events.onMemberAction('remove'));
    this.nodes.blockMemberBtn.addEventListener('click', () => events.onMemberAction('block'));
  }

  setUserId(userId) {
    this.nodes.userId.textContent = userId || '-';
  }

  setWsOnline(online) {
    this.nodes.wsState.textContent = online ? 'online' : 'offline';
    this.nodes.wsState.className = online ? 'good' : 'bad';
  }

  setKeyState(text, ok) {
    this.nodes.keyState.textContent = text;
    this.nodes.keyState.className = ok ? 'good' : 'bad';
  }

  appendStatus(text, type = 'info') {
    const item = document.createElement('div');
    item.className = `status-item ${type}`;
    item.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    this.nodes.statusList.prepend(item);
  }

  renderChats(chats, activeChatId, onClickChat) {
    this.nodes.chats.innerHTML = '';
    for (const chat of chats) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `chat-item ${String(chat.chatId) === String(activeChatId) ? 'active' : ''}`;
      row.textContent = chat.title || `Чат #${chat.chatId}`;
      row.addEventListener('click', () => onClickChat(chat.chatId));
      this.nodes.chats.appendChild(row);
    }
  }

  setChatTitle(title) {
    this.nodes.chatTitle.textContent = title || 'Выберите чат';
  }

  renderMessages(messages, selfUserId) {
    this.nodes.messageList.innerHTML = '';
    for (const message of messages) {
      const item = document.createElement('div');
      item.className = `message ${String(message.senderId) === String(selfUserId) ? 'mine' : 'other'}`;
      item.textContent = `${message.senderId}: ${message.text}`;
      this.nodes.messageList.appendChild(item);
    }
    this.nodes.messageList.scrollTop = this.nodes.messageList.scrollHeight;
  }

  renderSearchResult(row) {
    if (!row) {
      this.nodes.searchResult.textContent = 'Ничего не найдено.';
      return;
    }
    this.nodes.searchResult.innerHTML = '';
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'action';
    item.textContent = `Открыть/создать диалог с ${row.title || 'пользователем'}`;
    this.nodes.searchResult.appendChild(item);
    return item;
  }

  renderMembers(userIds) {
    this.nodes.membersList.innerHTML = '';
    for (const userId of userIds) {
      const item = document.createElement('div');
      item.className = 'member';
      item.textContent = userId;
      this.nodes.membersList.appendChild(item);
    }
  }
}
