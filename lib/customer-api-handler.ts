const actions = new Set(['session', 'state', 'import', 'claim', 'quote', 'pay', 'topup']);

export type CustomerApiDependencies = {
  engine: string;
  bridgeHeaders: (request: Request) => Record<string, string>;
  customerCookie: string;
  sameOrigin: (request: Request) => boolean;
  fetcher?: typeof fetch;
  logger?: Pick<Console, 'error'>;
};

function referenceId() {
  return crypto.randomUUID();
}

function safeBackendError(payload: Record<string, unknown>) {
  for (const key of ['error', 'detail']) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return 'پردازش درخواست در سرویس داخلی با خطا روبه‌رو شد.';
}

function errorResponse(message: string, status: number, reference?: string) {
  return Response.json(
    reference ? { error: message, reference } : { error: message },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

export async function handleCustomerPost(request: Request, dependencies: CustomerApiDependencies) {
  if (!dependencies.sameOrigin(request))
    return errorResponse('درخواست معتبر نیست.', 403);

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError('invalid body');
    body = parsed as Record<string, unknown>;
  } catch {
    return errorResponse('درخواست نامعتبر است.', 400);
  }

  const action = body.action;
  if (typeof action !== 'string' || !actions.has(action))
    return errorResponse('درخواست نامعتبر است.', 400);

  const fetcher = dependencies.fetcher ?? fetch;
  const logger = dependencies.logger ?? console;
  let response: Response;
  try {
    response = await fetcher(`${dependencies.engine}/internal/panel/customer/${action}`, {
      method: 'POST',
      headers: dependencies.bridgeHeaders(request),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
      cache: 'no-store',
    });
  } catch (error) {
    const reference = referenceId();
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    logger.error('customer bridge request failed', {
      action, reference, failure: timedOut ? 'timeout' : 'connection',
    });
    return errorResponse(
      timedOut
        ? 'پاسخ سرویس پردازش بیش از حد طول کشید؛ وضعیت پرداخت را پیش از تلاش دوباره بررسی کنید.'
        : 'ارتباط با سرویس پردازش برقرار نشد؛ وضعیت پرداخت را پیش از تلاش دوباره بررسی کنید.',
      timedOut ? 504 : 503,
      reference,
    );
  }

  const raw = await response.text();
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError('invalid payload');
    payload = parsed as Record<string, unknown>;
  } catch {
    const reference = referenceId();
    logger.error('customer bridge received invalid backend response', {
      action, reference, backendStatus: response.status,
      contentType: response.headers.get('content-type') ?? '',
    });
    return errorResponse(
      response.ok
        ? 'پاسخ سرویس پردازش معتبر نبود؛ وضعیت عملیات را دوباره بررسی کنید.'
        : 'سرویس پردازش با خطای داخلی روبه‌رو شد؛ هیچ پرداخت جدیدی را تا بررسی وضعیت تکرار نکنید.',
      502,
      reference,
    );
  }

  const headers: Record<string, string> = { 'cache-control': 'no-store' };
  if (payload.session && response.ok) {
    headers['set-cookie'] = `${dependencies.customerCookie}=${payload.session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`;
    delete payload.session;
  }
  if (!response.ok)
    return Response.json({ error: safeBackendError(payload) }, { status: response.status, headers });
  return Response.json(payload, { status: response.status, headers });
}
