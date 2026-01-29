export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(password, hash) {
  const hashedPassword = await hashPassword(password);
  return hashedPassword === hash;
}

export async function generateJWT(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = { ...payload, iat: now, exp: now + 86400 }; // 24 hours

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(jwtPayload));
  const signature = await sign(`${encodedHeader}.${encodedPayload}`, 'your-secret-key');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function verifyJWT(token) {
  try {
    const [header, payload, signature] = token.split('.');
    const expectedSignature = await sign(`${header}.${payload}`, 'your-secret-key');
    
    if (signature !== expectedSignature) return null;
    
    const decodedPayload = JSON.parse(atob(payload));
    if (decodedPayload.exp < Math.floor(Date.now() / 1000)) return null;
    
    return decodedPayload;
  } catch {
    return null;
  }
}

async function sign(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}