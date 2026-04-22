import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'http://localhost:8080';
const PASSWORD = 'Passw0rd!12345';
const RUN_ID = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const OUT_DIR = path.resolve('test/group-sequential-flow');

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(value) {
  return Buffer.from(value || '', 'base64');
}

function stringToBase64(value) {
  return Buffer.from(value || '', 'utf8').toString('base64');
}

function base64ToString(value) {
  return Buffer.from(value || '', 'base64').toString('utf8');
}

function assertOk(response, action) {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${action} failed: status=${response.status}, body=${response.raw}`);
  }
}

class Session {
  constructor(username) {
    this.username = username;
    this.cookies = new Map();
  }

  cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  rememberCookies(headers) {
    const setCookies = typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : String(headers.get('set-cookie') || '').split(/,(?=\s*[^;,]+=)/);

    for (const cookie of setCookies) {
      const first = String(cookie || '').split(';')[0];
      const index = first.indexOf('=');
      if (index > 0) {
        this.cookies.set(first.slice(0, index), first.slice(index + 1));
      }
    }
  }

  async request(method, url, body = undefined, contentType = 'application/json') {
    const headers = {};
    const cookie = this.cookieHeader();
    if (cookie) headers.Cookie = cookie;

    let payload;
    if (body !== undefined) {
      headers['Content-Type'] = contentType;
      payload = contentType === 'application/json' ? JSON.stringify(body) : String(body);
    }

    const response = await fetch(`${BASE_URL}${url}`, {
      method,
      headers,
      body: payload,
      redirect: 'follow'
    });

    this.rememberCookies(response.headers);
    const raw = await response.text();
    let data = raw;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      // Text response is fine for auth endpoints.
    }

    return { status: response.status, raw, data };
  }
}

async function generateUserKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['encrypt', 'decrypt']
  );

  return {
    publicKeyB64: bytesToBase64(new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey))),
    privateKeyB64: bytesToBase64(new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)))
  };
}

async function importPublicKey(publicKeyB64) {
  return crypto.subtle.importKey(
    'spki',
    base64ToBytes(publicKeyB64),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt']
  );
}

async function importPrivateKey(privateKeyB64) {
  return crypto.subtle.importKey(
    'pkcs8',
    base64ToBytes(privateKeyB64),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt']
  );
}

async function encryptForPublicKey(dataB64, publicKeyB64) {
  const publicKey = await importPublicKey(publicKeyB64);
  const aesRaw = crypto.getRandomValues(new Uint8Array(32));
  const aesKey = await crypto.subtle.importKey('raw', aesRaw, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, base64ToBytes(dataB64));
  const encryptedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, aesRaw);

  return stringToBase64(JSON.stringify({
    alg: 'RSA-OAEP+AES-GCM',
    key: bytesToBase64(new Uint8Array(encryptedKey)),
    iv: bytesToBase64(iv),
    cipher: bytesToBase64(new Uint8Array(cipher))
  }));
}

async function decryptWithPrivateKey(encryptedB64, privateKeyB64) {
  const privateKey = await importPrivateKey(privateKeyB64);
  const envelope = JSON.parse(base64ToString(encryptedB64));
  const aesRaw = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    base64ToBytes(envelope.key)
  );
  const aesKey = await crypto.subtle.importKey('raw', aesRaw, { name: 'AES-GCM' }, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) },
    aesKey,
    base64ToBytes(envelope.cipher)
  );
  return bytesToBase64(new Uint8Array(plain));
}

async function importSenderKey(senderKeyB64, usages) {
  return crypto.subtle.importKey('raw', base64ToBytes(senderKeyB64), { name: 'AES-GCM' }, false, usages);
}

async function encryptMessage(text, senderKeyB64) {
  const key = await importSenderKey(senderKeyB64, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, Buffer.from(text, 'utf8'));
  return stringToBase64(JSON.stringify({
    alg: 'AES-GCM',
    iv: bytesToBase64(iv),
    cipher: bytesToBase64(new Uint8Array(cipher))
  }));
}

async function decryptMessage(messageB64, senderKeyB64) {
  const key = await importSenderKey(senderKeyB64, ['decrypt']);
  const envelope = JSON.parse(base64ToString(messageB64));
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) },
    key,
    base64ToBytes(envelope.cipher)
  );
  return Buffer.from(plain).toString('utf8');
}

async function createUser(index) {
  const username = `seq_${RUN_ID}_${index}`;
  const session = new Session(username);
  const reg = await session.request('POST', '/auth/reg', { username, password: PASSWORD });
  assertOk(reg, `register ${username}`);

  const me = await session.request('GET', '/api/getId');
  assertOk(me, `get id ${username}`);

  const keyPair = await generateUserKeyPair();
  const saveKey = await session.request('POST', '/api/encrypt_key/new_key', keyPair.publicKeyB64, 'text/plain');
  assertOk(saveKey, `save public key ${username}`);

  const publicKey = await session.request('GET', '/api/encrypt_key/');
  assertOk(publicKey, `load public key ${username}`);

  return {
    index,
    username,
    id: String(me.data),
    session,
    publicKeyId: publicKey.data.id,
    publicKeyB64: publicKey.data.key,
    privateKeyB64: keyPair.privateKeyB64,
    senderKeys: new Map()
  };
}

async function getPublicKeys(actor, userIds) {
  const response = await actor.session.request('POST', '/api/encrypt_key/byUserIdIn', userIds);
  assertOk(response, `get public keys by ${actor.username}`);
  return response.data;
}

async function sendSenderKey(actor, chatId, encryptName, senderKeyB64, targetUsers) {
  const publicKeys = await getPublicKeys(actor, targetUsers.map((user) => user.id));
  const rows = [];
  for (const publicKey of publicKeys) {
    rows.push({
      userTarget: publicKey.userId,
      key: await encryptForPublicKey(senderKeyB64, publicKey.key),
      publicKeyUser: publicKey.id
    });
  }

  const body = {
    chatId,
    encryptName,
    requestEncryptMessageKeyForUsers: rows
  };
  const response = await actor.session.request('POST', '/api/encrypt_message_key/send', body);
  assertOk(response, `send sender key ${encryptName} by ${actor.username}`);
  return response.data.encryptName;
}

async function rotateSenderKey(actor, chatId, members) {
  const senderKeyB64 = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
  const encryptName = await sendSenderKey(actor, chatId, null, senderKeyB64, members);
  actor.senderKeys.set(encryptName, { chatId, keyB64: senderKeyB64, source: actor.id, owned: true });
  return { encryptName, keyB64: senderKeyB64 };
}

async function ensureSenderKey(actor, chatId, members) {
  for (const [encryptName, senderKey] of actor.senderKeys.entries()) {
    if (senderKey.owned && Number(senderKey.chatId) === Number(chatId)) {
      return { encryptName, keyB64: senderKey.keyB64 };
    }
  }
  return rotateSenderKey(actor, chatId, members);
}

async function ingestPendingKeys(user, chatId, storeImportedWithChatId) {
  const response = await user.session.request('GET', '/api/encrypt_message_key/pending');
  assertOk(response, `load pending keys ${user.username}`);
  const pending = Array.isArray(response.data) ? response.data : [];
  const imported = [];
  const failed = [];

  for (const item of pending) {
    if (!item.encryptName || user.senderKeys.has(item.encryptName)) {
      if (item.id) {
        await user.session.request('POST', '/api/encrypt_message_key/delete', { keyId: item.id });
      }
      continue;
    }

    try {
      const senderKeyB64 = await decryptWithPrivateKey(item.key, user.privateKeyB64);
      user.senderKeys.set(item.encryptName, {
        chatId: storeImportedWithChatId ? (item.chatId ?? null) : null,
        keyB64: senderKeyB64,
        source: item.userId,
        owned: false
      });
      imported.push(item.encryptName);
      if (item.id) {
        await user.session.request('POST', '/api/encrypt_message_key/delete', { keyId: item.id });
      }
    } catch (error) {
      failed.push({ encryptName: item.encryptName, error: error.message });
    }
  }

  return { imported, failed };
}

async function sendMessage(actor, chatId, members, text) {
  const senderKey = await ensureSenderKey(actor, chatId, members);
  const encrypted = await encryptMessage(text, senderKey.keyB64);
  const response = await actor.session.request('POST', '/api/sendMessage', {
    chatId,
    message: encrypted,
    encryptionName: senderKey.encryptName
  });
  assertOk(response, `send message by ${actor.username}`);
  return response.data;
}

async function addUserAndShareFrontendLike(owner, chatId, targetUser) {
  const add = await owner.session.request('POST', '/api/add_user_in_chat', {
    chatId,
    userTarget: targetUser.id
  });
  assertOk(add, `add ${targetUser.username}`);

  const sharedEncryptNames = [];
  for (const [encryptName, senderKey] of owner.senderKeys.entries()) {
    if (Number(senderKey.chatId) === Number(chatId)) {
      await sendSenderKey(owner, chatId, encryptName, senderKey.keyB64, [targetUser]);
      sharedEncryptNames.push(encryptName);
    }
  }
  return sharedEncryptNames;
}

async function decryptHistory(user, chatId) {
  const response = await user.session.request('GET', `/api/messages/${chatId}?limit=100`);
  assertOk(response, `load history for ${user.username}`);
  const messages = Array.isArray(response.data) ? response.data : [];
  const decrypted = [];
  const failed = [];

  for (const message of messages) {
    const senderKey = user.senderKeys.get(message.encryptionName);
    if (!senderKey?.keyB64) {
      failed.push({
        messageId: message.messageId,
        encryptName: message.encryptionName,
        reason: 'missing sender key'
      });
      continue;
    }

    try {
      decrypted.push({
        messageId: message.messageId,
        text: await decryptMessage(message.message, senderKey.keyB64)
      });
    } catch (error) {
      failed.push({
        messageId: message.messageId,
        encryptName: message.encryptionName,
        reason: error.message
      });
    }
  }

  return { total: messages.length, decrypted, failed };
}

async function runScenario({ storeImportedWithChatId }) {
  const users = [];
  for (let i = 1; i <= 6; i += 1) {
    users.push(await createUser(i));
  }

  const owner = users[0];
  const createGroup = await owner.session.request('POST', '/api/group_chat', {
    title: `Sequential test ${RUN_ID}`,
    avatarUrl: ''
  });
  assertOk(createGroup, 'create group');
  const chatId = createGroup.data.chatId;

  const activeMembers = [owner];
  const events = [];
  const historyChecks = [];

  const first = await sendMessage(owner, chatId, activeMembers, `${owner.username}: first group message`);
  events.push({ step: 'owner first message', messageId: first.messageId });
  await ingestPendingKeys(owner, chatId, storeImportedWithChatId);

  for (let i = 1; i < users.length; i += 1) {
    const newcomer = users[i];
    const shared = await addUserAndShareFrontendLike(owner, chatId, newcomer);
    const ingestNewcomer = await ingestPendingKeys(newcomer, chatId, storeImportedWithChatId);
    activeMembers.push(newcomer);

    const beforeSendHistory = await decryptHistory(newcomer, chatId);
    historyChecks.push({
      user: newcomer.username,
      phase: 'after add before own message',
      sharedEncryptNames: shared,
      imported: ingestNewcomer.imported,
      failed: beforeSendHistory.failed
    });

    const sent = await sendMessage(newcomer, chatId, activeMembers, `${newcomer.username}: hello after joining`);
    events.push({ step: `${newcomer.username} message`, messageId: sent.messageId });

    for (const member of activeMembers) {
      await ingestPendingKeys(member, chatId, storeImportedWithChatId);
    }

    const ownerHistory = await decryptHistory(owner, chatId);
    historyChecks.push({
      user: owner.username,
      phase: `after ${newcomer.username} message`,
      failed: ownerHistory.failed
    });
  }

  const finalChecks = [];
  for (const user of activeMembers) {
    const check = await decryptHistory(user, chatId);
    finalChecks.push({
      user: user.username,
      total: check.total,
      decryptedCount: check.decrypted.length,
      failed: check.failed
    });
  }

  return {
    mode: storeImportedWithChatId ? 'ideal-client-stores-chat-id' : 'current-frontend-like',
    runId: RUN_ID,
    chatId,
    users: users.map((user) => ({ username: user.username, id: user.id, publicKeyId: user.publicKeyId })),
    events,
    historyChecks,
    finalChecks
  };
}

await fs.mkdir(OUT_DIR, { recursive: true });

const fixedMode = process.argv.includes('--fixed');
const currentFrontendLike = await runScenario({ storeImportedWithChatId: fixedMode });
await fs.writeFile(
  path.join(OUT_DIR, `${fixedMode ? 'fixed-chat-id' : 'current-frontend-like'}-${RUN_ID}.json`),
  JSON.stringify(currentFrontendLike, null, 2),
  'utf8'
);

console.log(JSON.stringify(currentFrontendLike, null, 2));
