import { env } from 'cloudflare:workers';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key') || '';
  if (!key.startsWith('avatars/')) return new Response('Not found', { status: 404 });
  const object = await (env.FILES as R2Bucket).get(key);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(object.body, { headers });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get('file');
  const userId = String(form.get('userId') || '').replace(/[^A-Za-z0-9_-]/g, '');
  const oldKey = String(form.get('oldKey') || '');
  if (!(file instanceof File) || !userId || !allowedTypes.has(file.type) || file.size > 1_500_000)
    return Response.json({ error: 'Invalid image' }, { status: 400 });
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const key = `avatars/${userId}/${crypto.randomUUID()}.${extension}`;
  const bucket = env.FILES as R2Bucket;
  await bucket.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  if (oldKey.startsWith(`avatars/${userId}/`) && oldKey !== key) await bucket.delete(oldKey);
  return Response.json({ key, url: `/api/avatar?key=${encodeURIComponent(key)}` });
}
