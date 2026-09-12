import {
  clearSessionCookie,
  createAdminSession,
  normalizePhone,
  sessionCookie,
  verifyAdminSession,
  verifyPassword,
} from '@/lib/admin-auth';
const adminPhone = '09150467685';

export async function GET(request: Request) {
  return Response.json(
    { authenticated: await verifyAdminSession(request) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  let body: { phone?: string; password?: string } = {};
  try {
    body = await request.json();
  } catch {}
  const phone = normalizePhone(body.phone || '');
  const validPhone = phone === adminPhone;
  const suppliedPassword = body.password?.trim() || '';
  const validPassword = suppliedPassword
    ? await verifyPassword(suppliedPassword)
    : false;
  if (!validPhone || !validPassword)
    return Response.json(
      { error: 'Invalid phone number or password.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  const token = await createAdminSession();
  return Response.json(
    { authenticated: true },
    {
      headers: {
        'Set-Cookie': sessionCookie(token),
        'Cache-Control': 'no-store',
      },
    },
  );
}

export async function DELETE() {
  return Response.json(
    { authenticated: false },
    {
      headers: {
        'Set-Cookie': clearSessionCookie(),
        'Cache-Control': 'no-store',
      },
    },
  );
}
