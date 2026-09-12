import { env } from 'cloudflare:workers';
import { ENGINE, customerSession, sameOrigin, bridgeHeaders } from '@/lib/customer-bridge';

type BridgeEnv = { PANEL_BRIDGE_TOKEN?: string };

function bridgeToken() {
  const token = (env as unknown as BridgeEnv).PANEL_BRIDGE_TOKEN;
  if (!token) throw new Error('bridge_not_configured');
  return token;
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback;
}

function cleanId(value: unknown) {
  return stringValue(value).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'درخواست نامعتبر است.' }, { status: 403 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.action === 'status') {
      const engineProjectId = Number(body.engineProjectId);
      const projectToken = stringValue(body.projectToken);
      if (!Number.isInteger(engineProjectId) || engineProjectId < 1 || projectToken.length < 20)
        return Response.json({ error: 'شناسه پیگیری پروژه معتبر نیست.' }, { status: 400 });
      const response = await fetch(
        `${ENGINE}/internal/panel/projects/${engineProjectId}/status`,
        {
          headers: {
            accept: 'application/json',
            'x-panel-token': bridgeToken(),
            'x-project-token': projectToken,
          },
          cache: 'no-store',
        },
      );
      const payload = await response.text();
      return new Response(payload, {
        status: response.status,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }

    const projectId = cleanId(body.projectId);
    if (!customerSession(request)) return Response.json({ error: 'دوباره وارد پنل شوید.' }, { status: 401 });
    const userId = cleanId(body.userId);
    const sessionResponse = await fetch(`${ENGINE}/internal/panel/customer/state`, { method: 'POST', headers: bridgeHeaders(request), body: '{}', signal: AbortSignal.timeout(15000) });
    if (!sessionResponse.ok) return Response.json({ error: 'دوباره وارد پنل شوید.' }, { status: 401 });
    const session = await sessionResponse.json() as { userId: string };
    if (session.userId !== userId) return Response.json({ error: 'مالک فایل معتبر نیست.' }, { status: 403 });
    const fileKey = stringValue(body.fileKey);
    const fileName = stringValue(body.fileName, 'project.dxf').slice(0, 240);
    const discipline = body.discipline === 'electrical' ? 'electrical' : 'mechanical';
    if (!projectId || !userId || !fileKey.startsWith(`projects/${userId}/`))
      return Response.json({ error: 'اطلاعات فایل پروژه معتبر نیست.' }, { status: 400 });
    const object = await (env.FILES as R2Bucket).get(fileKey);
    if (!object) return Response.json({ error: 'فایل پروژه پیدا نشد.' }, { status: 404 });
    const bytes = await object.arrayBuffer();
    const form = new FormData();
    form.append('external_project_id', projectId);
    form.append('external_user_id', userId);
    form.append('name', stringValue(body.title, projectId));
    form.append('discipline', discipline);
    form.append('occupancy', stringValue(body.occupancy));
    form.append('answers_json', JSON.stringify(body.answers || {}));
    form.append('file', new File([bytes], fileName, { type: object.httpMetadata?.contentType || 'application/octet-stream' }));
    const response = await fetch(`${ENGINE}/internal/panel/projects`, {
      method: 'POST',
      headers: { accept: 'application/json', 'x-panel-token': bridgeToken(), 'x-customer-session': customerSession(request) },
      body: form,
      signal: AbortSignal.timeout(180_000),
    });
    const payload = await response.text();
    return new Response(payload, {
      status: response.status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch (error) {
    console.error('design project bridge failed', error);
    return Response.json(
      { error: 'آماده‌سازی پروژه انجام نشد؛ دوباره تلاش کنید.' },
      { status: 503 },
    );
  }
}
