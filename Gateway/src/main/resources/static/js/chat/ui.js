const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='28' fill='%23d7ebff'/%3E%3Cpath d='M20 36 34 18l10 20M76 36 62 18 52 38' fill='%2377aee9'/%3E%3Crect x='24' y='34' width='48' height='44' rx='22' fill='%23f7fbff' stroke='%236aa0d9' stroke-width='4'/%3E%3Ccircle cx='38' cy='52' r='4' fill='%2335577a'/%3E%3Ccircle cx='58' cy='52' r='4' fill='%2335577a'/%3E%3Cpath d='M42 63c4-3 8-3 12 0' stroke='%2335577a' stroke-width='4' stroke-linecap='round' fill='none'/%3E%3C/svg%3E";

export class ChatUi {
  constructor() {
    this.searchMode = false;
    this.statusItems = [];
    this.nodes = {
      settingsBtn: document.getElementById('settingsBtn'),
      catPattern: document.getElementById('catPattern'),
      settingsIcon: document.getElementById('settingsIcon'),
      settingsLabel: document.getElementById('settingsLabel'),
      searchInput: document.getElementById('searchInput'),
      searchBtn: document.getElementById('searchBtn'),
      searchResult: document.getElementById('searchResult'),
      chatList: document.getElementById('chatList'),
      sidebarTitle: document.getElementById('sidebarTitle'),
      sidebarHint: document.getElementById('sidebarHint'),
      createChatBtn: document.getElementById('createChatBtn'),
      createChatModal: document.getElementById('createChatModal'),
      createChatTitleInput: document.getElementById('createChatTitleInput'),
      createChatContinueBtn: document.getElementById('createChatContinueBtn'),
      createChatCloseBtn: document.getElementById('createChatCloseBtn'),
      userId: document.getElementById('userId'),
      wsState: document.getElementById('wsState'),
      keyState: document.getElementById('keyState'),
      chatHeader: document.getElementById('chatHeader'),
      chatContent: document.getElementById('chatContent'),
      activeChatAvatar: document.getElementById('activeChatAvatar'),
      chatTitle: document.getElementById('chatTitle'),
      chatSubtitle: document.getElementById('chatSubtitle'),
      chatPresence: document.getElementById('chatPresence'),
      chatPresenceDot: document.getElementById('chatPresenceDot'),
      chatMenuBtn: document.getElementById('chatMenuBtn'),
      chatMenu: document.getElementById('chatMenu'),
      messageList: document.getElementById('messageList'),
      scrollBottomBtn: document.getElementById('scrollBottomBtn'),
      emptyChatState: document.getElementById('emptyChatState'),
      messageInput: document.getElementById('messageInput'),
      sendBtn: document.getElementById('sendBtn'),
      composerHint: document.getElementById('composerHint'),
      membersList: document.getElementById('membersList'),
      membersTitle: document.getElementById('membersTitle'),
      membersHint: document.getElementById('membersHint'),
      memberInput: document.getElementById('memberInput'),
      addMemberBtn: document.getElementById('addMemberBtn'),
      removeMemberBtn: document.getElementById('removeMemberBtn'),
      blockMemberBtn: document.getElementById('blockMemberBtn'),
      chatOptionsPanel: document.getElementById('chatOptionsPanel'),
      chatOptionsCloseBtn: document.getElementById('chatOptionsCloseBtn'),
      statusList: document.getElementById('statusList'),
      reloadBtn: document.getElementById('reloadBtn'),
      bootstrapKeysBtn: document.getElementById('bootstrapKeysBtn'),
      wsReconnectBtn: document.getElementById('wsReconnectBtn'),
      logoutBtn: document.getElementById('logoutBtn'),
      groupTitleInput: document.getElementById('groupTitleInput'),
      createGroupBtn: document.getElementById('createGroupBtn'),
      composer: document.getElementById('composer'),
      servicePanelToggle: document.getElementById('servicePanelToggle'),
      messageMenu: document.getElementById('messageMenu')
    };
    this.#renderCatPattern();
  }

  bind(events) {
    this.events = events;

    this.nodes.settingsBtn.addEventListener('click', () => {
      if (this.searchMode) {
        events.onExitSearch?.();
      } else {
        events.onOpenSettings?.();
      }
    });

    this.nodes.searchBtn.addEventListener('click', () => events.onSearchUser?.());
    this.nodes.createChatBtn.addEventListener('click', () => this.openCreateChatModal());
    this.nodes.createChatCloseBtn.addEventListener('click', () => this.closeCreateChatModal());
    this.nodes.createChatModal.addEventListener('click', (event) => {
      if (event.target === this.nodes.createChatModal) {
        this.closeCreateChatModal();
      }
    });
    this.nodes.createChatContinueBtn.addEventListener('click', () => events.onCreateGroupChatModal?.());
    this.nodes.createChatTitleInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        events.onCreateGroupChatModal?.();
      }
    });
    this.nodes.searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        events.onSearchUser?.();
      }
    });

    this.nodes.sendBtn.addEventListener('click', () => events.onSendMessage?.());
    this.nodes.messageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        events.onSendMessage?.();
      }
    });

    this.nodes.createGroupBtn?.addEventListener('click', () => events.onCreateGroupChat?.());
    this.nodes.chatMenuBtn.addEventListener('click', () => events.onToggleChatMenu?.());
    this.nodes.chatOptionsCloseBtn.addEventListener('click', () => this.setOptionsPanelOpen(false));
    this.nodes.addMemberBtn.addEventListener('click', () => events.onMemberAction?.('add'));
    this.nodes.removeMemberBtn.addEventListener('click', () => events.onMemberAction?.('remove'));
    this.nodes.blockMemberBtn.addEventListener('click', () => events.onMemberAction?.('block'));
    this.nodes.reloadBtn.addEventListener('click', () => events.onReload?.());
    this.nodes.bootstrapKeysBtn.addEventListener('click', () => events.onBootstrapKeys?.());
    this.nodes.wsReconnectBtn.addEventListener('click', () => events.onWsReconnect?.());
    this.nodes.logoutBtn.addEventListener('click', () => events.onLogout?.());
    this.nodes.servicePanelToggle.addEventListener('click', () => events.onOpenSettings?.('actions'));

    this.nodes.messageList.addEventListener('contextmenu', (event) => {
      const card = event.target.closest('[data-message-id]');
      if (!card) {
        return;
      }
      event.preventDefault();
      const payload = {
        messageId: Number(card.dataset.messageId),
        senderId: card.dataset.senderId,
        mine: card.dataset.mine === 'true'
      };
      events.onMessageContext?.({ x: event.clientX, y: event.clientY, payload });
    });

    this.nodes.messageList.addEventListener('scroll', () => this.#updateScrollBottomButton());
    this.nodes.scrollBottomBtn.addEventListener('click', () => this.scrollMessagesToBottom());

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.menu') && !event.target.closest('.icon-button--menu')) {
        this.hideChatMenu();
        this.hideMessageMenu();
      }
    });
  }

  setUserId(userId) {
    const full = userId || '-';
    this.nodes.userId.textContent = this.#shortId(full);
    this.nodes.userId.title = full;
  }

  setWsOnline(online) {
    this.nodes.wsState.textContent = online ? 'в сети' : 'offline';
    this.nodes.wsState.className = `meta-pill__value ${online ? 'is-good good' : 'is-bad bad'}`;
  }

  setKeyState(text, ok) {
    this.nodes.keyState.textContent = text;
    this.nodes.keyState.className = `meta-pill__value ${ok ? 'is-good good' : 'is-bad bad'}`;
  }

  appendStatus(text, type = 'info') {
    this.statusItems.unshift({
      text,
      type,
      time: new Date()
    });
    this.statusItems = this.statusItems.slice(0, 40);
    this.#renderStatusItems();
  }

  setSearchMode(active) {
    this.searchMode = Boolean(active);
    this.nodes.chatList.hidden = this.searchMode;
    this.nodes.searchResult.hidden = !this.searchMode;
    this.nodes.settingsLabel.textContent = this.searchMode ? 'назад' : 'настройки';
    this.nodes.settingsIcon.textContent = this.searchMode ? '←' : '⚙';
    this.nodes.sidebarTitle.textContent = this.searchMode ? 'Результаты поиска' : 'Ваши чаты';
    this.nodes.sidebarHint.textContent = this.searchMode
      ? 'Сначала идут ваши диалоги и группы, затем люди без открытого чата.'
      : 'Личные диалоги и группы с последней активностью.';
  }

  clearSearchResults(message = 'Введите запрос, чтобы найти чат, группу или человека.') {
    this.nodes.searchResult.innerHTML = `<div class="empty-state empty-state--compact">${this.#escapeHtml(message)}</div>`;
  }

  renderSearchResults(results, onSelect) {
    this.setSearchMode(true);
    this.nodes.searchResult.innerHTML = '';
    if (!Array.isArray(results) || results.length === 0) {
      this.clearSearchResults('Ничего не найдено. Попробуйте другой ник или название.');
      return;
    }

    const groups = this.#groupResults(results);
    groups.forEach((group) => {
      const block = document.createElement('section');
      block.className = 'search-section';
      block.innerHTML = `<div class="search-section__title">${this.#escapeHtml(group.title)}</div>`;
      group.items.forEach((item) => {
        const row = this.#buildSidebarCard(item, false);
        row.classList.add('search-card');
        row.addEventListener('click', () => onSelect(item));
        block.appendChild(row);
      });
      this.nodes.searchResult.appendChild(block);
    });
  }

  renderChats(chats, activeChatId, onClickChat) {
    this.nodes.chatList.innerHTML = '';
    if (!Array.isArray(chats) || chats.length === 0) {
      this.nodes.chatList.innerHTML = '<div class="empty-state empty-state--compact">Пока нет диалогов. Найдите собеседника или создайте группу в настройках.</div>';
      return;
    }

    chats.forEach((chat) => {
      const card = this.#buildSidebarCard(chat, String(chat.chatId) === String(activeChatId));
      card.addEventListener('click', () => onClickChat(chat.chatId));
      this.nodes.chatList.appendChild(card);
    });
  }

  setActiveChatInList(chatId) {
    Array.from(this.nodes.chatList.querySelectorAll('.dialog-card')).forEach((card) => {
      const active = String(card.dataset.chatId) === String(chatId);
      card.classList.toggle('is-active', active);
      card.classList.toggle('active', active);
    });
  }

  renderActiveChat(chat) {
    if (!chat) {
      this.nodes.chatHeader.hidden = true;
      this.nodes.composer.hidden = true;
      this.nodes.activeChatAvatar.src = DEFAULT_AVATAR;
      this.nodes.chatTitle.textContent = 'Выберите чат';
      this.nodes.chatTitle.title = 'Чат еще не выбран';
      this.nodes.chatSubtitle.textContent = 'Сообщения появятся здесь после выбора диалога.';
      this.nodes.chatPresence.textContent = '';
      this.nodes.chatPresenceDot.className = 'presence-dot';
      this.nodes.chatMenuBtn.disabled = true;
      this.nodes.messageInput.disabled = true;
      this.nodes.sendBtn.disabled = true;
      this.nodes.messageInput.placeholder = 'Сначала выберите чат';
      this.nodes.emptyChatState.hidden = false;
      this.nodes.messageList.innerHTML = '';
      this.setOptionsPanelOpen(false);
      return;
    }

    this.nodes.chatHeader.hidden = false;
    this.nodes.composer.hidden = false;
    this.nodes.activeChatAvatar.src = chat.avatarUrl || DEFAULT_AVATAR;
    this.nodes.chatTitle.textContent = chat.title || `Чат #${chat.chatId}`;
    this.nodes.chatTitle.title = chat.counterpartUserId || chat.chatId || '';
    this.nodes.chatSubtitle.textContent = chat.chatType === 'GROUP'
      ? `${chat.memberCount || 0} участников`
      : 'Личный диалог';
    this.nodes.chatPresence.textContent = this.#presenceLabel(chat);
    this.nodes.chatPresenceDot.className = `presence-dot ${this.#presenceClass(chat)}`;
    this.nodes.chatMenuBtn.disabled = false;
    this.nodes.messageInput.disabled = false;
    this.nodes.sendBtn.disabled = false;
    this.nodes.messageInput.placeholder = 'Напишите сообщение';
    this.nodes.emptyChatState.hidden = true;
  }

  renderMessages(messages, selfUserId, chat = null) {
    this.nodes.messageList.innerHTML = '';
    this.nodes.scrollBottomBtn.hidden = true;
    if (!Array.isArray(messages) || messages.length === 0) {
      if (this.nodes.chatTitle.textContent !== 'Выберите чат') {
        this.nodes.messageList.innerHTML = '<div class="empty-state">Сообщений пока нет. Начните разговор первым.</div>';
      }
      return;
    }

    let previousDateKey = null;
    messages.forEach((message) => {
      const dateKey = this.#dateKey(message.createdAt);
      if (dateKey !== previousDateKey) {
        previousDateKey = dateKey;
        const divider = document.createElement('div');
        divider.className = 'message-date-divider';
        divider.innerHTML = `<span>${this.#escapeHtml(this.#formatDate(message.createdAt))}</span>`;
        this.nodes.messageList.appendChild(divider);
      }

      const mine = String(message.senderId) === String(selfUserId);
      const author = this.#messageAuthor(message, selfUserId, chat);
      const card = document.createElement('article');
      card.className = `message-card message ${mine ? 'is-mine mine' : 'is-other other'}`;
      card.dataset.messageId = String(message.messageId);
      card.dataset.senderId = String(message.senderId || '');
      card.dataset.mine = String(mine);
      card.innerHTML = `
        <div class="message-card__avatar">${this.#avatarMarkup(author.avatarUrl, author.name)}</div>
        <div class="message-card__bubble">
          <div class="message-card__meta">
            <span class="message-card__author">${this.#escapeHtml(author.name)}</span>
            <time>${this.#formatTime(message.createdAt)}</time>
          </div>
          <div class="message-card__text">${this.#escapeHtml(message.text || '')}</div>
        </div>
      `;
      this.nodes.messageList.appendChild(card);
    });

    this.scrollMessagesToBottom();
  }

  scrollMessagesToBottom() {
    this.nodes.messageList.scrollTop = this.nodes.messageList.scrollHeight;
    this.#updateScrollBottomButton();
  }

  renderMembers(members, chat) {
    this.nodes.membersList.innerHTML = '';
    this.nodes.membersTitle.textContent = chat?.chatType === 'GROUP' ? 'Участники чата' : 'Собеседник';
    this.nodes.membersHint.textContent = chat?.chatType === 'GROUP'
      ? 'Добавляйте, удаляйте или блокируйте участников, если роль это позволяет.'
      : 'В личном диалоге можно посмотреть собеседника и при необходимости заблокировать его в этом чате.';

    const canManage = Boolean(chat?.canManageMembers);
    const isPrivate = chat?.chatType === 'PERSONAL';

    this.nodes.memberInput.disabled = isPrivate || !canManage;
    this.nodes.addMemberBtn.hidden = isPrivate || !canManage;
    this.nodes.removeMemberBtn.hidden = isPrivate || !canManage;
    this.nodes.blockMemberBtn.textContent = isPrivate ? 'Заблокировать пользователя' : 'Заблокировать в чате';
    this.nodes.blockMemberBtn.hidden = !(isPrivate || canManage);

    if (!Array.isArray(members) || members.length === 0) {
      this.nodes.membersList.innerHTML = '<div class="empty-state empty-state--compact">Список участников пока пуст.</div>';
      return;
    }

    members.forEach((member) => {
      const row = document.createElement('div');
      row.className = 'member-row';
      row.innerHTML = `
        <div class="member-row__avatar">${this.#avatarMarkup(member.avatarUrl, member.username)}</div>
        <div class="member-row__body">
          <div class="member-row__name" title="${this.#escapeHtml(member.userId || '')}">${this.#escapeHtml(member.username || this.#shortId(member.userId))}</div>
          <div class="member-row__meta">${member.online ? 'в сети' : 'offline'}</div>
        </div>
      `;
      this.nodes.membersList.appendChild(row);
    });
  }

  renderChatMenu(items) {
    this.nodes.chatMenu.innerHTML = '';
    if (!Array.isArray(items) || items.length === 0) {
      this.hideChatMenu();
      return;
    }

    items.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `menu__item ${item.danger ? 'is-danger' : ''}`;
      button.textContent = item.label;
      button.addEventListener('click', () => {
        this.hideChatMenu();
        item.onClick?.();
      });
      this.nodes.chatMenu.appendChild(button);
    });

    this.nodes.chatMenu.hidden = false;
  }

  hideChatMenu() {
    this.nodes.chatMenu.hidden = true;
  }

  renderMessageMenu(x, y, items, payload) {
    this.nodes.messageMenu.innerHTML = '';
    if (!Array.isArray(items) || items.length === 0) {
      this.hideMessageMenu();
      return;
    }

    items.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `menu__item ${item.danger ? 'is-danger' : ''}`;
      button.textContent = item.label;
      button.addEventListener('click', () => {
        this.hideMessageMenu();
        item.onClick?.(payload);
      });
      this.nodes.messageMenu.appendChild(button);
    });

    this.nodes.messageMenu.hidden = false;
    this.nodes.messageMenu.style.left = `${x}px`;
    this.nodes.messageMenu.style.top = `${y}px`;
  }

  hideMessageMenu() {
    this.nodes.messageMenu.hidden = true;
  }

  setOptionsPanelOpen(open) {
    this.nodes.chatOptionsPanel.hidden = !open;
    this.nodes.chatContent.classList.toggle('has-options-open', Boolean(open));
  }

  setComposerLocked(locked, hint = '') {
    this.nodes.messageInput.disabled = locked;
    this.nodes.sendBtn.disabled = locked;
    if (hint && this.nodes.composerHint) {
      this.nodes.composerHint.textContent = hint;
    }
  }

  openCreateChatModal() {
    this.nodes.createChatModal.hidden = false;
    this.nodes.createChatTitleInput.focus();
  }

  closeCreateChatModal() {
    this.nodes.createChatModal.hidden = true;
  }

  #renderStatusItems() {
    this.nodes.statusList.innerHTML = '';
    if (this.statusItems.length === 0) {
      this.nodes.statusList.innerHTML = '<div class="empty-state empty-state--compact">Событий пока нет.</div>';
      return;
    }

    this.statusItems.forEach((item) => {
      const row = document.createElement('div');
      row.className = `status-entry status-item status-entry--${item.type}`;
      row.innerHTML = `
        <div class="status-entry__time">${item.time.toLocaleTimeString()}</div>
        <div class="status-entry__text">${this.#escapeHtml(item.text)}</div>
      `;
      this.nodes.statusList.appendChild(row);
    });
  }

  #buildSidebarCard(chat, active) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `dialog-card chat-item ${active ? 'is-active active' : ''}`;
    card.dataset.chatId = chat.chatId ? String(chat.chatId) : '';
    card.innerHTML = `
      <div class="dialog-card__avatar">${this.#avatarMarkup(chat.avatarUrl, chat.title)}</div>
      <div class="dialog-card__body">
        <div class="dialog-card__top">
          <span class="dialog-card__title">${this.#escapeHtml(chat.title || `Чат #${chat.chatId || '?'}`)}</span>
          <span class="dialog-card__badge">${this.#escapeHtml(this.#badgeLabel(chat))}</span>
        </div>
        <div class="dialog-card__preview">${this.#escapeHtml(chat.previewText || this.#fallbackPreview(chat))}</div>
        <div class="dialog-card__bottom">
          <span class="dialog-card__status">${this.#escapeHtml(this.#presenceLabel(chat))}</span>
        </div>
      </div>
    `;
    return card;
  }

  #groupResults(results) {
    const existing = results.filter((item) => item.kind === 'existing-chat');
    const users = results.filter((item) => item.kind === 'user');
    const groups = [];
    if (existing.length) {
      groups.push({ title: 'Чаты и группы', items: existing });
    }
    if (users.length) {
      groups.push({ title: 'Люди без открытого диалога', items: users });
    }
    return groups;
  }

  #badgeLabel(chat) {
    if (chat.kind === 'user') {
      return 'новый чат';
    }
    return chat.chatType === 'GROUP' ? 'группа' : 'личный';
  }

  #presenceLabel(chat) {
    if (!chat) {
      return '';
    }
    if (chat.chatType === 'GROUP') {
      return `в сети ${chat.onlineCount || 0} из ${chat.memberCount || 0}`;
    }
    return chat.counterpartOnline ? 'в сети' : 'offline';
  }

  #presenceClass(chat) {
    if (chat?.chatType === 'GROUP') {
      return (chat.onlineCount || 0) > 0 ? 'is-online' : 'is-offline';
    }
    return chat?.counterpartOnline ? 'is-online' : 'is-offline';
  }

  #fallbackPreview(chat) {
    if (chat.kind === 'user') {
      return 'Нажмите, чтобы открыть личный диалог';
    }
    return chat.chatType === 'GROUP' ? 'Групповой чат' : 'Личный диалог';
  }

  #formatTime(value) {
    if (!value) {
      return 'сейчас';
    }
    try {
      return new Date(value).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'сейчас';
    }
  }

  #formatDate(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
      return 'сегодня';
    }
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  #dateKey(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
      return 'unknown';
    }
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  #messageAuthor(message, selfUserId, chat) {
    const participant = (chat?.participants || [])
      .find((item) => String(item.userId) === String(message.senderId));

    if (participant) {
      return {
        name: participant.username || (String(message.senderId) === String(selfUserId) ? 'Вы' : 'Пользователь'),
        avatarUrl: participant.avatarUrl || ''
      };
    }

    return {
      name: message.senderUsername || (String(message.senderId) === String(selfUserId) ? 'Вы' : 'Пользователь'),
      avatarUrl: message.senderAvatarUrl || ''
    };
  }

  #updateScrollBottomButton() {
    const list = this.nodes.messageList;
    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    this.nodes.scrollBottomBtn.hidden = distanceFromBottom < 420;
  }

  #avatarMarkup(url, title) {
    if (url) {
      return `<img src="${this.#escapeHtml(url)}" alt="${this.#escapeHtml(title || 'avatar')}" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}'">`;
    }
    return `<span>${this.#escapeHtml(this.#initials(title))}</span>`;
  }

  #shortId(value) {
    const text = String(value || '-');
    if (text.length <= 18) {
      return text;
    }
    return `${text.slice(0, 8)}...${text.slice(-6)}`;
  }

  #initials(value) {
    const text = String(value || '?').trim();
    if (!text) {
      return '?';
    }
    return text.replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 2).toUpperCase() || '?';
  }

  #renderCatPattern() {
    if (!this.nodes.catPattern) {
      return;
    }

    const rows = 24;
    const cols = 28;
    const variants = 10;
    const angles = [-13, 8, -5, 15, -18, 4, 11, -9, 19, -3];
    const sizes = [28, 31, 34, 29, 37, 32, 26, 35, 30, 33];
    const fragment = document.createDocumentFragment();

    this.nodes.catPattern.innerHTML = '';
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = (row * 7 + col * 3) % variants;
        const cat = document.createElement('span');
        cat.className = `cat-sprite cat-sprite--${index + 1}`;
        cat.style.left = `${row * 18 + col * 54 + ((row + col) % 3) * 5 - 26}px`;
        cat.style.top = `${row * 48 + ((col % 2) * 6) - 18}px`;
        cat.style.width = `${sizes[index]}px`;
        cat.style.height = `${sizes[index]}px`;
        cat.style.transform = `rotate(${angles[index]}deg)`;
        fragment.appendChild(cat);
      }
    }

    this.nodes.catPattern.appendChild(fragment);
  }

  #escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
