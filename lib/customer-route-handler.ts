export type CustomerRouteDependencies = {
  engine: string;
  bridgeHeaders(request: Request): Record<string, string>;
  customerCookie: string;
  sameOrigin(request: Request): boolean;
  fetcher?: typeof fetch;
};

const actions = new Set(['session', 'state', 'import', 'claim', 'quote', 'pay', 'topup']);
const publicErrors: Record<string, { statuses: number[]; message: string }> = {
  ENGINEERING_INPUT_REQUIRED: {
    statuses: [409, 422],
    message: 'هویت یا اطلاعات مهندسی پروژه نیاز به اصلاح یا تأیید دارد؛ هیچ پرداختی انجام نشد.',
  },
  DRAWING_MANIFEST_CONTRACT_ERROR: {
    statuses: [500],
    message: 'قرارداد مجموعه نقشه‌های مکانیکی معتبر نشد؛ هیچ پرداختی انجام نشد و این مورد نیاز به بررسی سیستم دارد.',
  },
};

function upstreamFailure(status: number) {
  if (status === 401) return 'نشست ورود منقضی شده است؛ دوباره وارد پنل شوید.';
  if (status === 403) return 'اجازه دسترسی به این پروژه را ندارید.';
  if (status === 409 || status === 422)
    return 'اطلاعات مهندسی پروژه برای ادامه کافی یا معتبر نیست؛ موارد خواسته‌شده را اصلاح کنید.';
  return 'پردازش داخلی پروژه ناموفق بود؛ هیچ پرداختی انجام نشد. لطفاً کد پیگیری را برای پشتیبانی ارسال کنید.';
}

function normalizeFailure(value: unknown, status: number): Record<string, unknown> {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const detail = source.detail && typeof source.detail === 'object' && !Array.isArray(source.detail)
    ? source.detail as Record<string, unknown> : {};
  const code = typeof source.error_code === 'string' ? source.error_code
    : typeof detail.error_code === 'string' ? detail.error_code : '';
  const contract = publicErrors[code];
  if (contract && contract.statuses.includes(status)) {
    const payload: Record<string, unknown> = { error_code: code, error: contract.message };
    const rawInputs = source.required_inputs ?? detail.required_inputs;
    if (Array.isArray(rawInputs)) {
      payload.required_inputs = rawInputs
        .filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 80)
        .slice(0, 32);
    }
    const reference = source.reference_id ?? detail.reference_id;
    if (typeof reference === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(reference))
      payload.reference_id = reference;
    return payload;
  }
  return { error: upstreamFailure(status) };
}

export async function handleCustomerRequest(request: Request, dependencies: CustomerRouteDependencies) {
  if (!dependencies.sameOrigin(request))
    return Response.json({ error: 'درخواست معتبر نیست.' }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    const decoded = await request.json() as unknown;
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded))
      return Response.json({ error: 'ساختار درخواست نامعتبر است.' }, { status: 400 });
    body = decoded as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'ساختار درخواست نامعتبر است.' }, { status: 400 });
  }
  const action = body.action;
  if (typeof action !== 'string' || !actions.has(action))
    return Response.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });

  let response: Response;
  try {
    response = await (dependencies.fetcher || fetch)(
      `${dependencies.engine}/internal/panel/customer/${action}`,
      {
        method: 'POST', headers: dependencies.bridgeHeaders(request), body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000), cache: 'no-store',
      },
    );
  } catch {
    return Response.json(
      { error: 'ارتباط با سرور برقرار نشد؛ وضعیت پرداخت را پیش از تلاش دوباره بررسی کنید.', error_code: 'BACKEND_UNAVAILABLE' },
      { status: 503 },
    );
  }

  try {
    const raw = await response.text();
    let decoded: unknown = null;
    if (raw) {
      try { decoded = JSON.parse(raw); } catch { decoded = null; }
    }
    const payload = response.ok && decoded && typeof decoded === 'object' && !Array.isArray(decoded)
      ? { ...(decoded as Record<string, unknown>) }
      : normalizeFailure(decoded, response.status);
    const headers: Record<string, string> = { 'cache-control': 'no-store' };
    if (payload.session && response.ok) {
      headers['set-cookie'] = `${dependencies.customerCookie}=${payload.session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`;
      delete payload.session;
    }
    return Response.json(payload, { status: response.status, headers });
  } catch {
    return Response.json(
      { error: 'پردازش داخلی درخواست ناموفق بود؛ هیچ پرداختی انجام نشد.', error_code: 'SITE_INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
