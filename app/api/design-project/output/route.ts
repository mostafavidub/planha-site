import { env } from 'cloudflare:workers';

const ENGINE = 'https://web-app-production-3d3b.up.railway.app';
type BridgeEnv = { PANEL_BRIDGE_TOKEN?: string };

function stringValue(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const engineProjectId = Number(body.engineProjectId);
    const projectToken = stringValue(body.projectToken);
    const token = (env as unknown as BridgeEnv).PANEL_BRIDGE_TOKEN;
    if (!token) throw new Error('bridge_not_configured');
    if (!Number.isInteger(engineProjectId) || engineProjectId < 1 || projectToken.length < 20)
      return Response.json({ error: 'شناسه دانلود معتبر نیست.' }, { status: 400 });
    const response = await fetch(
      `${ENGINE}/internal/panel/projects/${engineProjectId}/output`,
      {
        headers: { 'x-panel-token': token, 'x-project-token': projectToken },
        redirect: 'follow',
        signal: AbortSignal.timeout(120_000),
      },
    );
    if (!response.ok || !response.body)
      return Response.json({ error: 'خروجی پروژه هنوز آماده دانلود نیست.' }, { status: response.status });
    const headers = new Headers();
    headers.set('content-type', response.headers.get('content-type') || 'application/octet-stream');
    headers.set(
      'content-disposition',
      response.headers.get('content-disposition') || `attachment; filename="EngiTools_${engineProjectId}.zip"`,
    );
    headers.set('cache-control', 'private, no-store');
    return new Response(response.body, { status: 200, headers });
  } catch (error) {
    console.error('design output bridge failed', error);
    return Response.json({ error: 'دانلود خروجی انجام نشد.' }, { status: 503 });
  }
}
