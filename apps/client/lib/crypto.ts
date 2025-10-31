import * as Crypto from 'expo-crypto';

export function getUrlSafeNonce(byteLength = 32) {
  if (byteLength < 1) {
    throw new Error('Byte length must be positive');
  }

  const randomBytes = Crypto.getRandomValues(new Uint8Array(byteLength));
  return btoa(String.fromCharCode(...randomBytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/[=]/g, '');
}
