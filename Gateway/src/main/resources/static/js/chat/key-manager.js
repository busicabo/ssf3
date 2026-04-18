import { LIMITS } from './constants.js';
import { normalizeBase64 } from './base64.js';

export class KeyManager {
  constructor({ api, db, crypto, ui }) {
    this.api = api;
    this.db = db;
    this.crypto = crypto;
    this.ui = ui;
    this.userId = null;
    this.currentKey = null;
  }

  async init(userId) {
    this.userId = userId;
    this.currentKey = await this.db.getCurrentUserKey(userId);
  }

  async bootstrap() {
    this.currentKey = await this.db.getCurrentUserKey(this.userId);
    const serverKey = await this.#safeGetOwnPublicKey();

    if (!this.currentKey && !serverKey) {
      await this.#createAndUploadNewCurrentKey();
      this.ui.setKeyState('Создана новая пара user-ключей.', true);
      return;
    }

    if (this.currentKey && !serverKey) {
      await this.api.saveOwnPublicKey(this.currentKey.publicKeyB64);
      const fresh = await this.#safeGetOwnPublicKey();
      if (fresh) {
        await this.#setCurrent({
          publicKeyId: fresh.id,
          publicKeyB64: fresh.keyB64,
          privateKeyB64: this.currentKey.privateKeyB64
        });
      }
      this.ui.setKeyState('Публичный ключ восстановлен на сервере.', true);
      return;
    }

    if (!this.currentKey && serverKey) {
      const restored = await this.#tryRestoreFromPending(serverKey.id);
      if (!restored) {
        await this.#createAndUploadNewCurrentKey();
      }
      this.ui.setKeyState('Ключи пользователя готовы.', true);
      return;
    }

    if (this.#isSamePublicKey(this.currentKey, serverKey)) {
      await this.#setCurrent({
        publicKeyId: serverKey.id,
        publicKeyB64: serverKey.keyB64,
        privateKeyB64: this.currentKey.privateKeyB64
      });
      this.ui.setKeyState('Ключи пользователя синхронизированы.', true);
      return;
    }

    const restored = await this.#tryRestoreFromPending(serverKey.id);
    if (!restored) {
      await this.api.saveOwnPublicKey(this.currentKey.publicKeyB64);
      const fresh = await this.#safeGetOwnPublicKey();
      if (fresh) {
        await this.#setCurrent({
          publicKeyId: fresh.id,
          publicKeyB64: fresh.keyB64,
          privateKeyB64: this.currentKey.privateKeyB64
        });
      }
    }
    this.ui.setKeyState('Ключи пользователя обновлены.', true);
  }

  async ensureSenderKey(chatId, memberIds) {
    let usage = null;
    try {
      usage = await this.api.getLatestKeyUsage(chatId);
      if (usage?.encryptionName) {
        await this.db.setUsage(this.userId, chatId, usage.encryptionName, usage.count || 0);
      }
    } catch (error) {
      if (error.status !== 404 && error.status !== 204) {
        throw error;
      }
    }

    const currentUsage = usage?.encryptionName
      ? { encryptName: usage.encryptionName, count: Number(usage.count || 0) }
      : await this.db.getUsage(this.userId, chatId);

    if (currentUsage?.encryptName && Number(currentUsage.count || 0) < LIMITS.maxMessagesPerSenderKey) {
      const localSenderKey = await this.db.getSenderKey(this.userId, currentUsage.encryptName);
      if (localSenderKey?.keyB64) {
        return { encryptName: currentUsage.encryptName, keyB64: localSenderKey.keyB64 };
      }
    }

    await this.ingestPendingMessageKeys();

    const afterSyncUsage = await this.db.getUsage(this.userId, chatId);
    if (afterSyncUsage?.encryptName && Number(afterSyncUsage.count || 0) < LIMITS.maxMessagesPerSenderKey) {
      const localSenderKey = await this.db.getSenderKey(this.userId, afterSyncUsage.encryptName);
      if (localSenderKey?.keyB64) {
        return { encryptName: afterSyncUsage.encryptName, keyB64: localSenderKey.keyB64 };
      }
    }

    return this.rotateSenderKey(chatId, memberIds);
  }

  async rotateSenderKey(chatId, memberIds) {
    const publicKeys = await this.api.getPublicKeysByUsers(memberIds);
    if (!Array.isArray(publicKeys) || publicKeys.length === 0) {
      throw new Error('Не удалось получить публичные ключи участников.');
    }

    const senderKeyB64 = this.crypto.generateSenderKey();
    const requestRows = [];
    let skippedInvalidKeys = 0;

    for (const key of publicKeys) {
      const publicKeyB64 = normalizeBase64(key.key);
      if (!publicKeyB64) {
        skippedInvalidKeys += 1;
        continue;
      }

      let encryptedSenderKey;
      try {
        encryptedSenderKey = await this.crypto.encryptForPublicKey(senderKeyB64, publicKeyB64);
      } catch (error) {
        skippedInvalidKeys += 1;
        console.warn('Пропущен некорректный публичный ключ участника.', {
          userId: key.userId,
          keyId: key.id,
          error: error?.message || error
        });
        continue;
      }
      requestRows.push({
        userTarget: key.userId,
        key: encryptedSenderKey,
        publicKeyUser: key.id
      });
    }

    if (requestRows.length === 0) {
      throw new Error('Нет валидных публичных ключей для отправки sender key.');
    }

    if (skippedInvalidKeys > 0) {
      this.ui.appendStatus(`Пропущено некорректных публичных ключей: ${skippedInvalidKeys}.`, 'info');
    }

    const result = await this.api.sendMessageKeys({
      chatId,
      requestEncryptMessageKeyForUsers: requestRows
    });

    const encryptName = String(result?.encryptName || '');
    if (!encryptName) {
      throw new Error('Сервер не вернул encryptName.');
    }

    await this.db.upsertSenderKey(this.userId, {
      chatId,
      encryptName,
      keyB64: senderKeyB64,
      publicKeyId: null
    });
    await this.db.setUsage(this.userId, chatId, encryptName, 0);

    return { encryptName, keyB64: senderKeyB64 };
  }

  async incrementUsage(chatId, encryptName) {
    return this.db.incrementUsage(this.userId, chatId, encryptName);
  }

  async getSenderKey(encryptName) {
    return this.db.getSenderKey(this.userId, encryptName);
  }

  async ingestPendingMessageKeys() {
    const pending = await this.#safeGetPendingMessageKeys();
    if (pending.length === 0) return;

    for (const item of pending) {
      const encryptName = item.encryptName;
      if (!encryptName) continue;

      const keyExists = await this.db.getSenderKey(this.userId, encryptName);
      if (keyExists) {
        if (item.id) {
          await this.#safeDeletePending(item.id);
        }
        continue;
      }

      const publicKeyId = item.publicKey || item.publicKeyUser;
      if (!publicKeyId) continue;
      const privateKeyEntity = await this.db.findPrivateKeyByPublicId(this.userId, publicKeyId);
      if (!privateKeyEntity?.privateKeyB64) continue;

      const encryptedKeyB64 = normalizeBase64(item.key);
      if (!encryptedKeyB64) continue;

      let senderKeyB64;
      try {
        senderKeyB64 = await this.crypto.decryptWithPrivateKey(encryptedKeyB64, privateKeyEntity.privateKeyB64);
      } catch {
        continue;
      }

      await this.db.upsertSenderKey(this.userId, {
        chatId: null,
        encryptName,
        keyB64: senderKeyB64,
        publicKeyId
      });

      if (item.id) {
        await this.#safeDeletePending(item.id);
      }
    }
  }

  async decryptMessage(messageB64, encryptName) {
    if (!messageB64) return '';
    if (!encryptName) {
      return this.#bestEffortDecode(messageB64);
    }

    const senderKey = await this.db.getSenderKey(this.userId, encryptName);
    if (!senderKey?.keyB64) {
      return '[Ключ сообщения пока не получен]';
    }

    try {
      return await this.crypto.decryptMessage(messageB64, senderKey.keyB64);
    } catch {
      return '[Не удалось расшифровать сообщение]';
    }
  }

  async #createAndUploadNewCurrentKey() {
    const generated = await this.crypto.generateUserKeyPair();
    await this.api.saveOwnPublicKey(generated.publicKeyB64);
    const serverKey = await this.#safeGetOwnPublicKey();
    const publicKeyId = serverKey?.id || crypto.randomUUID();
    const publicKeyB64 = serverKey?.keyB64 || generated.publicKeyB64;

    await this.#setCurrent({
      publicKeyId,
      publicKeyB64,
      privateKeyB64: generated.privateKeyB64
    });
  }

  async #setCurrent(key) {
    await this.db.setCurrentUserKey(this.userId, {
      publicKeyId: key.publicKeyId,
      publicKeyB64: key.publicKeyB64,
      privateKeyB64: key.privateKeyB64
    });
    this.currentKey = await this.db.getCurrentUserKey(this.userId);
  }

  async #safeGetOwnPublicKey() {
    try {
      const payload = await this.api.getOwnPublicKey();
      if (!payload || typeof payload !== 'object') {
        return null;
      }
      return {
        id: payload.id ? String(payload.id) : null,
        userId: payload.userId ? String(payload.userId) : null,
        keyB64: normalizeBase64(payload.key)
      };
    } catch (error) {
      if (error.status === 404 || error.status === 204) {
        return null;
      }
      throw error;
    }
  }

  async #safeGetPendingMessageKeys() {
    try {
      const payload = await this.api.getPendingMessageKeys();
      return Array.isArray(payload) ? payload : [];
    } catch (error) {
      if (error.status === 404 || error.status === 204) {
        return [];
      }
      throw error;
    }
  }

  async #safeDeletePending(id) {
    try {
      await this.api.deletePendingMessageKey(id);
    } catch {
      // Ignore delete races
    }
  }

  async #tryRestoreFromPending(expectedPublicKeyId) {
    let pending;
    try {
      pending = await this.api.getNewPrivateKey();
    } catch (error) {
      if (error.status === 404 || error.status === 204) {
        return false;
      }
      throw error;
    }

    if (!pending || typeof pending !== 'object') {
      return false;
    }

    const pendingPublic = pending.publicKey ? String(pending.publicKey) : null;
    if (expectedPublicKeyId && pendingPublic && pendingPublic !== String(expectedPublicKeyId)) {
      return false;
    }

    const encryptedPrivateB64 = normalizeBase64(pending.key);
    const encryptingPublicKey = pending.encryptingPublicKey ? String(pending.encryptingPublicKey) : null;
    if (!encryptedPrivateB64 || !encryptingPublicKey) {
      return false;
    }

    const decryptor = await this.db.findPrivateKeyByPublicId(this.userId, encryptingPublicKey);
    if (!decryptor?.privateKeyB64) {
      return false;
    }

    let decryptedPrivateB64;
    try {
      decryptedPrivateB64 = await this.crypto.decryptWithPrivateKey(encryptedPrivateB64, decryptor.privateKeyB64);
    } catch {
      return false;
    }

    const keys = await this.api.getPublicKeysByIds([pendingPublic]);
    const resolvedPublic = Array.isArray(keys) && keys.length > 0
      ? normalizeBase64(keys[0].key)
      : null;
    if (!resolvedPublic) {
      return false;
    }

    await this.#setCurrent({
      publicKeyId: pendingPublic,
      publicKeyB64: resolvedPublic,
      privateKeyB64: decryptedPrivateB64
    });
    return true;
  }

  #isSamePublicKey(localKey, serverKey) {
    if (!localKey || !serverKey) return false;
    if (localKey.publicKeyId && serverKey.id && String(localKey.publicKeyId) === String(serverKey.id)) {
      return true;
    }
    return localKey.publicKeyB64 && serverKey.keyB64 && localKey.publicKeyB64 === serverKey.keyB64;
  }

  #bestEffortDecode(messageB64) {
    try {
      return decodeURIComponent(escape(atob(messageB64)));
    } catch {
      return '[Сообщение зашифровано]';
    }
  }
}
