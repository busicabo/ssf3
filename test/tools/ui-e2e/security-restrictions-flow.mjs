const BASE_URL = 'http://localhost:8080';

class Session {
  constructor(name) {
    this.name = name;
    this.cookies = new Map();
  }

  cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  #storeCookies(response) {
    const setCookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];

    if (setCookies.length > 0) {
      for (const raw of setCookies) {
        const [pair] = raw.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) {
          this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
        }
      }
      return;
    }

    const single = response.headers.get('set-cookie');
    if (!single) {
      return;
    }
    const split = single.split(/,(?=\s*[^;=,\s]+=[^;=,\s]+)/g);
    for (const raw of split) {
      const [pair] = raw.split(';');
      const idx = pair.indexOf('=');
      if (idx > 0) {
        this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
      }
    }
  }

  async request(path, options = {}) {
    const {
      method = 'GET',
      body = undefined,
      contentType = null,
      expected = null
    } = options;

    const headers = {};
    const cookie = this.cookieHeader();
    if (cookie) {
      headers.Cookie = cookie;
    }
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body,
      redirect: 'follow'
    });

    this.#storeCookies(response);

    const contentTypeResp = (response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();
    let payload = null;

    if (text) {
      if (contentTypeResp.includes('application/json')) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      } else {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      }
    }

    if (expected != null) {
      const expectedList = Array.isArray(expected) ? expected : [expected];
      if (!expectedList.includes(response.status)) {
        throw new Error(`[${this.name}] ${method} ${path} -> ${response.status}, expected ${expectedList.join('/')}. Body: ${text}`);
      }
    }

    return {
      status: response.status,
      payload,
      text
    };
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeUuidLike(payload) {
  if (!payload) return null;
  if (typeof payload === 'string') {
    return payload.replace(/^"|"$/g, '').trim();
  }
  if (typeof payload === 'object') {
    if (typeof payload.id === 'string') return payload.id;
    if (typeof payload.userId === 'string') return payload.userId;
    if (typeof payload.value === 'string') return payload.value;
  }
  return null;
}

async function registerUser(alias) {
  const session = new Session(alias);
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const username = `sec_${alias}_${suffix}`;
  const password = 'P@ssword12345';

  await session.request('/auth/reg', {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ username, password }),
    expected: 200
  });

  const idRes = await session.request('/api/getId', { expected: 200 });
  const userId = normalizeUuidLike(idRes.payload);
  assert(userId, `[${alias}] /api/getId did not return userId`);
  return { session, username, password, userId };
}

async function loginUser(username, password, alias) {
  const session = new Session(alias);
  await session.request('/auth/login', {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ username, password }),
    expected: 200
  });
  const idRes = await session.request('/api/getId', { expected: 200 });
  return {
    session,
    userId: normalizeUuidLike(idRes.payload)
  };
}

async function run() {
  console.log('STEP 1: регистрация двух пользователей');
  const userA = await registerUser('a');
  const userB = await registerUser('b');
  const userASecondDevice = await loginUser(userA.username, userA.password, 'a2');

  console.log('STEP 2: запрет на добавление в чат');
  await userA.session.request('/api/settings/preferences/allow-add-chat', {
    method: 'PATCH',
    contentType: 'application/json',
    body: JSON.stringify({ value: false }),
    expected: 200
  });

  const forbiddenChat = await userB.session.request('/api/personal_chat', {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ userId: userA.userId }),
    expected: 403
  });
  assert(String(forbiddenChat.text || '').length > 0, 'Не получили текст ошибки при запрете на добавление в чат.');

  console.log('STEP 3: разрешение добавления и создание личного чата');
  await userA.session.request('/api/settings/preferences/allow-add-chat', {
    method: 'PATCH',
    contentType: 'application/json',
    body: JSON.stringify({ value: true }),
    expected: 200
  });

  const personalChat = await userB.session.request('/api/personal_chat', {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ userId: userA.userId }),
    expected: 200
  });
  const chatId = Number(personalChat.payload?.chatId);
  assert(Number.isFinite(chatId) && chatId > 0, 'Личный чат не был создан.');

  console.log('STEP 4: запрет на запись в личные сообщения');
  await userA.session.request('/api/settings/preferences/allow-writing', {
    method: 'PATCH',
    contentType: 'application/json',
    body: JSON.stringify({ value: false }),
    expected: 200
  });

  const deniedMessage = await userB.session.request('/api/sendMessage', {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({
      chatId,
      message: Buffer.from('blocked message').toString('base64'),
      encryptionName: 'test-encrypt-name'
    }),
    expected: 403
  });
  assert(String(deniedMessage.text || '').length > 0, 'Не получили текст ошибки при запрете на запись.');

  console.log('STEP 5: смена пароля и инвалидизация старой сессии');
  const newPassword = 'P@ssword54321';
  await userA.session.request('/api/settings/security/change-password', {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({
      currentPassword: userA.password,
      newPassword,
      confirmPassword: newPassword
    }),
    expected: 200
  });

  await userA.session.request('/api/getId', { expected: 401 });
  await userASecondDevice.session.request('/api/getId', { expected: 401 });

  console.log('STEP 6: вход с новым паролем и logout-all');
  const refreshedUserA = await loginUser(userA.username, newPassword, 'a3');
  const refreshedUserASecond = await loginUser(userA.username, newPassword, 'a4');

  await refreshedUserA.session.request('/api/settings/security/logout-all', {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({}),
    expected: 200
  });

  await refreshedUserA.session.request('/api/getId', { expected: 401 });
  await refreshedUserASecond.session.request('/api/getId', { expected: 401 });

  console.log('SECURITY FLOW RESULT: OK');
}

run().catch((error) => {
  console.error('SECURITY FLOW RESULT: FAILED');
  console.error(error?.stack || String(error));
  process.exit(1);
});
