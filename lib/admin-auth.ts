import { env } from 'cloudflare:workers';

const encoder = new TextEncoder();
const cookieName = 'engi_admin_session';
const adminPhone = '09150467685';
const passwordSalt = 'engi-admin-v3:';
const passwordHash = 'b3750216d81880e2863182123fc4a053b6bafa1b1d40efa57e22b3934429efff';

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function hmac(value: string, secret = String(env.ADMIN_SESSION_SECRET)) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return bytesToHex(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', key, encoder.encode(value)),
    ),
  );
}

export function normalizePhone(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/\D/g, '');
}

export async function verifyPassword(password: string) {
  return safeEqual(
    await hmac(passwordSalt + password, String(env.ADMIN_PASSWORD_PEPPER)),
    passwordHash,
  );
}

export async function createAdminSession() {
  const expires = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
  const payload = `${adminPhone}.${expires}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifyAdminSession(request: Request) {
  const cookies = request.headers.get('cookie') || '';
  const token = cookies
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!token) return false;
  const [phone, expires, signature] = token.split('.');
  if (
    !phone ||
    !expires ||
    !signature ||
    phone !== adminPhone ||
    Number(expires) < Date.now() / 1000
  )
    return false;
  return safeEqual(signature, await hmac(`${phone}.${expires}`));
}

export function sessionCookie(token: string) {
  return `${cookieName}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`;
}

export function clearSessionCookie() {
  return `${cookieName}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
