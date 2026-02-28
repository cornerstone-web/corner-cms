const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface UploadTokenPayload {
  token: string;
  r2Key: string;
  expiry: number;
}

/**
 * Generate a short-lived HMAC-SHA256 upload token for corner-media.
 * The token authorizes a PUT /upload for the specific r2Key within TTL.
 */
export async function generateUploadToken(
  r2Key: string,
  secret: string,
): Promise<UploadTokenPayload> {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const message = `${r2Key}:${expiry}`;

  const keyData = new TextEncoder().encode(secret);
  const msgData = new TextEncoder().encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const token = bufferToBase64url(signature);

  return { token, r2Key, expiry };
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
