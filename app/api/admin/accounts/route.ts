import { verifyAdminSession } from '@/lib/admin-auth';
import { ENGINE, bridgeHeaders, sameOrigin } from '@/lib/customer-bridge';

export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await verifyAdminSession(request)))
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    if (!['state', 'wallet_adjustment'].includes(String(body.action)))
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    const response = await fetch(`${ENGINE}/internal/panel/admin/accounts`, {
      method: 'POST', headers: bridgeHeaders(request), body: JSON.stringify(body),
      cache: 'no-store', signal: AbortSignal.timeout(30_000),
    });
    return Response.json(await response.json(), { status: response.status, headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: 'ارتباط با حساب‌ها قطع شد؛ پیش از تکرار، موجودی را بررسی کنید.' }, { status: 503 });
  }
}
