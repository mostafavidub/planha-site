import { env } from 'cloudflare:workers';

// A missing binding must fail closed. In particular, local development and CI
// must never silently wake the online Staging backend.
export const ENGINE =
  (env as unknown as { PLANHA_ENGINE_URL?: string }).PLANHA_ENGINE_URL?.trim().replace(/\/+$/, '') ||
  'http://127.0.0.1:0';
export const customerCookie = 'engi_customer_session';
export function customerSession(request: Request) {
  return request.headers.get('cookie')?.split(';').map(x => x.trim())
    .find(x => x.startsWith(customerCookie + '='))?.slice(customerCookie.length + 1) || '';
}
export function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}
export function bridgeHeaders(request: Request) {
  const token = (env as unknown as { PANEL_BRIDGE_TOKEN?: string }).PANEL_BRIDGE_TOKEN;
  if (!token) throw new Error('bridge_not_configured');
  return { 'content-type': 'application/json', 'x-panel-token': token,
    'x-customer-session': customerSession(request), accept: 'application/json' };
}
