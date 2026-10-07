import { env } from 'cloudflare:workers';

export const ENGINE =
  (env as unknown as { PLANHA_ENGINE_URL?: string }).PLANHA_ENGINE_URL?.trim() ||
  'https://web-app-staging-production.up.railway.app';
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
