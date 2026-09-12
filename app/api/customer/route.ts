import { ENGINE, bridgeHeaders, customerCookie, sameOrigin } from '@/lib/customer-bridge';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'درخواست معتبر نیست.' }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = body.action;
    if (typeof action !== 'string' || !['session', 'state', 'import', 'claim', 'quote', 'pay', 'topup'].includes(action))
      return Response.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
    const response = await fetch(`${ENGINE}/internal/panel/customer/${action}`, {
      method: 'POST', headers: bridgeHeaders(request), body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000), cache: 'no-store',
    });
    const payload = await response.json() as Record<string, unknown>;
    const headers: Record<string, string> = { 'cache-control': 'no-store' };
    if (payload.session && response.ok) {
      headers['set-cookie'] = `${customerCookie}=${payload.session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`;
      delete payload.session;
    }
    return Response.json(payload, { status: response.status, headers });
  } catch {
    return Response.json({ error: 'ارتباط با حساب کاربری قطع شد؛ وضعیت پرداخت را پیش از تلاش دوباره بررسی کنید.' }, { status: 503 });
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({}, { status: 403 });
  return Response.json({}, { headers: { 'set-cookie': `${customerCookie}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`, 'cache-control': 'no-store' } });
}
