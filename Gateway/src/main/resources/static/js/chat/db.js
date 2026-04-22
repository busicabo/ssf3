import { DB_NAME, DB_VERSION, STORE } from './constants.js';

export class FrontendDb {
  constructor() {
    this.dbPromise = null;
  }

  async init() {
    if (!this.dbPromise) {
      this.dbPromise = this.#open();
    }
    return this.dbPromise;
  }

  async getCurrentUserKey(userId) {
    const rows = await this.#getAllByIndex(STORE.userKeys, 'userId', userId);
    return rows.find((row) => row.isCurrent) || null;
  }

  async listUserKeys(userId) {
    return this.#getAllByIndex(STORE.userKeys, 'userId', userId);
  }

  async findPrivateKeyByPublicId(userId, publicKeyId) {
    const row = await this.#getById(STORE.userKeys, this.#key(userId, publicKeyId));
    return row || null;
  }

  async setCurrentUserKey(userId, key) {
    const all = await this.listUserKeys(userId);
    const db = await this.init();
    await this.#tx(db, [STORE.userKeys], 'readwrite', async (tx) => {
      const store = tx.objectStore(STORE.userKeys);
      for (const row of all) {
        if (row.isCurrent) {
          row.isCurrent = false;
          store.put(row);
        }
      }

      store.put({
        id: this.#key(userId, key.publicKeyId),
        userId,
        publicKeyId: key.publicKeyId,
        publicKeyB64: key.publicKeyB64,
        privateKeyB64: key.privateKeyB64,
        isCurrent: true,
        createdAt: key.createdAt || new Date().toISOString()
      });
    });
  }

  async upsertSenderKey(userId, key) {
    await this.#put(STORE.senderKeys, {
      id: this.#key(userId, key.encryptName),
      userId,
      chatId: key.chatId ?? null,
      encryptName: key.encryptName,
      keyB64: key.keyB64,
      publicKeyId: key.publicKeyId ?? null,
      createdAt: key.createdAt || new Date().toISOString()
    });
  }

  async getSenderKey(userId, encryptName) {
    return this.#getById(STORE.senderKeys, this.#key(userId, encryptName));
  }

  async listSenderKeys(userId) {
    return this.#getAllByIndex(STORE.senderKeys, 'userId', userId);
  }

  async getUsage(userId, chatId) {
    return this.#getById(STORE.usage, this.#key(userId, String(chatId)));
  }

  async setUsage(userId, chatId, encryptName, count) {
    await this.#put(STORE.usage, {
      id: this.#key(userId, String(chatId)),
      userId,
      chatId: Number(chatId),
      encryptName: encryptName || null,
      count: Number(count || 0),
      updatedAt: new Date().toISOString()
    });
  }

  async incrementUsage(userId, chatId, encryptName) {
    const existing = await this.getUsage(userId, chatId);
    const nextCount = existing && existing.encryptName === encryptName
      ? Number(existing.count || 0) + 1
      : 1;
    await this.setUsage(userId, chatId, encryptName, nextCount);
    return nextCount;
  }

  async #open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE.userKeys)) {
          const userKeys = db.createObjectStore(STORE.userKeys, { keyPath: 'id' });
          userKeys.createIndex('userId', 'userId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE.senderKeys)) {
          const senderKeys = db.createObjectStore(STORE.senderKeys, { keyPath: 'id' });
          senderKeys.createIndex('userId', 'userId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE.usage)) {
          const usage = db.createObjectStore(STORE.usage, { keyPath: 'id' });
          usage.createIndex('userId', 'userId', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB init failed'));
    });
  }

  async #tx(db, stores, mode, callback) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result;

      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));

      Promise.resolve(callback(tx))
        .then((value) => {
          result = value;
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  async #put(storeName, value) {
    const db = await this.init();
    await this.#tx(db, [storeName], 'readwrite', (tx) => {
      tx.objectStore(storeName).put(value);
    });
  }

  async #getById(storeName, id) {
    const db = await this.init();
    return this.#tx(db, [storeName], 'readonly', (tx) => new Promise((resolve, reject) => {
      const req = tx.objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('IndexedDB get failed'));
    }));
  }

  async #getAllByIndex(storeName, indexName, value) {
    const db = await this.init();
    return this.#tx(db, [storeName], 'readonly', (tx) => new Promise((resolve, reject) => {
      const index = tx.objectStore(storeName).index(indexName);
      const req = index.getAll(IDBKeyRange.only(value));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error('IndexedDB getAll failed'));
    }));
  }

  #key(userId, idPart) {
    return `${userId}:${idPart}`;
  }
}
