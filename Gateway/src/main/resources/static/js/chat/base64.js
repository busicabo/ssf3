function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function stripPemEnvelope(value) {
  return value
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
}

export function normalizeBase64(raw) {
  if (!raw) return null;

  if (typeof raw === 'string') {
    let value = raw.trim();
    if (!value) return null;

    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1).trim();
    }

    value = stripPemEnvelope(value);
    return value || null;
  }

  if (Array.isArray(raw)) {
    return bytesToBase64(new Uint8Array(raw));
  }

  if (raw instanceof Uint8Array) {
    return bytesToBase64(raw);
  }

  if (ArrayBuffer.isView(raw)) {
    return bytesToBase64(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
  }

  if (raw instanceof ArrayBuffer) {
    return bytesToBase64(new Uint8Array(raw));
  }

  if (raw?.type === 'Buffer' && Array.isArray(raw.data)) {
    return bytesToBase64(new Uint8Array(raw.data));
  }

  if (Array.isArray(raw?.data)) {
    return bytesToBase64(new Uint8Array(raw.data));
  }

  return null;
}
