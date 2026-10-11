export type CustomerRouteDependencies = {
  engine: string;
  bridgeHeaders(request: Request): Record<string, string>;
  customerCookie: string;
  sameOrigin(request: Request): boolean;
  fetcher?: typeof fetch;
};

const actions = new Set(['session', 'state', 'import', 'claim', 'quote', 'pay', 'topup']);

function upstreamFailure(status: number) {
  if (status === 401) return 'نشست ورود منقضی شده است؛ دوباره وارد پنل شوید.';
  if (status === 403) return 'اجازه دسترسی به این پروژه را ندارید.';
  if (status === 409 || status === 422)
    return 'اطلاعات مهندسی پروژه برای ادامه کافی یا معتبر نیست؛ موارد خواسته‌شده را اصلاح کنید.';
  return 'پردازش داخلی پروژه ناموفق بود؛ هیچ پرداختی انجام نشد. لطفاً کد پیگیری را برای پشتیبانی ارسال کنید.';
}

function normalizePayload(value: unknown, status: number): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { error: upstreamFailure(status) };
  const payload = { ...(value as Record<string, unknown>) };
  const detail = payload.detail;
  if (!payload.error && typeof detail === 'string') payload.error = detail;
  if (!payload.error && detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const structured = detail as Record<string, unknown>;
    if (typeof structured.error === 'string') payload.error = structured.error;
    if (!payload.error_code && typeof structured.error_code === 'string')
      payload.error_code = structured.error_code;
  }
  if (!payload.error && status >= 400) payload.error = upstreamFailure(status);
  delete payload.detail;
  return payload;
}

export async function handleCustomerRequest(request: Request, dependencies: CustomerRouteDependencies) {
  if (!dependencies.sameOrigin(request))
    return Response.json({ error: 'درخواست معتبر نیست.' }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = body.action;
    if (typeof action !== 'string' || !actions.has(action))
      return Response.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
    const response = await (dependencies.fetcher || fetch)(
      `${dependencies.engine}/internal/panel/customer/${action}`,
      {
        method: 'POST', headers: dependencies.bridgeHeaders(request), body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000), cache: 'no-store',
      },
    );
    const raw = await response.text();
    let decoded: unknown = null;
    if (raw) {
      try { decoded = JSON.parse(raw); } catch { decoded = null; }
    }
    const payload = normalizePayload(decoded, response.status);
    const headers: Record<string, string> = { 'cache-control': 'no-store' };
    if (payload.session && response.ok) {
      headers['set-cookie'] = `${dependencies.customerCookie}=${payload.session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`;
      delete payload.session;
    }
    return Response.json(payload, { status: response.status, headers });
  } catch {
    return Response.json(
      { error: 'ارتباط با سرور برقرار نشد؛ وضعیت پرداخت را پیش از تلاش دوباره بررسی کنید.', error_code: 'BACKEND_UNAVAILABLE' },
      { status: 503 },
    );
  }
}
