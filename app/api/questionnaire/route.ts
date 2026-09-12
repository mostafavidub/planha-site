const ENGINE = 'https://web-app-production-3d3b.up.railway.app';

export async function GET(request: Request) {
  const discipline =
    new URL(request.url).searchParams.get('discipline') === 'electrical'
      ? 'electrical'
      : 'mechanical';
  try {
    const response = await fetch(`${ENGINE}/api/questionnaire/${discipline}`, {
      signal: AbortSignal.timeout(3500),
      headers: { accept: 'application/json' },
    });
    if (response.ok)
      return new Response(await response.text(), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'public, max-age=300',
        },
      });
  } catch {}
  return Response.json(
    { error: 'موتور مرکزی پرسش‌ها در دسترس نیست.' },
    { status: 503 },
  );
}
