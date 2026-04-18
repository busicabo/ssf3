const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export class CryptoEngine {
  async generateUserKeyPair() {
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

    const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
      publicKeyB64: this.bytesToBase64(new Uint8Array(publicKey)),
      privateKeyB64: this.bytesToBase64(new Uint8Array(privateKey))
    };
  }

  async encryptForPublicKey(dataB64, publicKeyB64) {
    const publicKey = await this.importPublicKey(publicKeyB64);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      this.base64ToBytes(dataB64)
    );
    return this.bytesToBase64(new Uint8Array(encrypted));
  }

  async decryptWithPrivateKey(encryptedB64, privateKeyB64) {
    const privateKey = await this.importPrivateKey(privateKeyB64);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      this.base64ToBytes(encryptedB64)
    );
    return this.bytesToBase64(new Uint8Array(decrypted));
  }

  generateSenderKey() {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    return this.bytesToBase64(raw);
  }

  async encryptMessage(plainText, senderKeyB64) {
    const key = await this.importSenderKey(senderKeyB64);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      textEncoder.encode(plainText)
    );

    const payload = {
      alg: 'AES-GCM',
      iv: this.bytesToBase64(iv),
      cipher: this.bytesToBase64(new Uint8Array(cipher))
    };

    return this.stringToBase64(JSON.stringify(payload));
  }

  async decryptMessage(messageB64, senderKeyB64) {
    const decoded = this.base64ToString(messageB64);
    const payload = JSON.parse(decoded);
    const key = await this.importSenderKey(senderKeyB64);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.base64ToBytes(payload.iv) },
      key,
      this.base64ToBytes(payload.cipher)
    );
    return textDecoder.decode(plain);
  }

  async importPublicKey(publicKeyB64) {
    try {
      return await crypto.subtle.importKey(
        'spki',
        this.base64ToBytes(publicKeyB64),
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['encrypt']
      );
    } catch (error) {
      throw new Error(`Некорректный публичный ключ: ${error?.name || 'ImportError'}`);
    }
  }

  async importPrivateKey(privateKeyB64) {
    return crypto.subtle.importKey(
      'pkcs8',
      this.base64ToBytes(privateKeyB64),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      true,
      ['decrypt']
    );
  }

  async importSenderKey(senderKeyB64) {
    return crypto.subtle.importKey(
      'raw',
      this.base64ToBytes(senderKeyB64),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  base64ToBytes(base64) {
    const binary = atob(base64 || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  stringToBase64(value) {
    return btoa(unescape(encodeURIComponent(value || '')));
  }

  base64ToString(value) {
    return decodeURIComponent(escape(atob(value || '')));
  }
}
