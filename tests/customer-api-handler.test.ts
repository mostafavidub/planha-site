import assert from 'node:assert/strict';
import test from 'node:test';

import { handleCustomerPost, type CustomerApiDependencies } from '../lib/customer-api-handler';

function request(body: unknown = { action: 'pay', method: 'gateway' }) {
  return new Request('http://site.local/api/customer', {
    method: 'POST',
    headers: { origin: 'http://site.local', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function harness(fetcher: typeof fetch) {
  const errors: unknown[][] = [];
  const dependencies: CustomerApiDependencies = {
    engine: 'http://engine.local',
    bridgeHeaders: () => ({ 'x-panel-token': 'test', 'content-type': 'application/json' }),
    customerCookie: 'planha_customer',
    sameOrigin: () => true,
    fetcher,
    logger: { error: (...args: unknown[]) => { errors.push(args); } },
  };
  return { dependencies, errors };
}

test('successful backend JSON is returned unchanged', async () => {
  const { dependencies } = harness(async () => Response.json({ paid: true }, { status: 200 }));
  const response = await handleCustomerPost(request(), dependencies);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { paid: true });
});

test('valid backend JSON 4xx safely propagates detail and status', async () => {
  const { dependencies } = harness(async () => Response.json({ detail: 'قیمت منقضی شده است.' }, { status: 409 }));
  const response = await handleCustomerPost(request(), dependencies);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'قیمت منقضی شده است.' });
});

test('valid backend JSON 5xx safely propagates error and status', async () => {
  const { dependencies } = harness(async () => Response.json({ error: 'پرداختی ثبت نشد.' }, { status: 503 }));
  const response = await handleCustomerPost(request(), dependencies);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'پرداختی ثبت نشد.' });
});

test('non-JSON backend 500 becomes safe invalid-upstream response with reference', async () => {
  const { dependencies, errors } = harness(async () => new Response('Internal Server Error', {
    status: 500, headers: { 'content-type': 'text/plain' },
  }));
  const response = await handleCustomerPost(request(), dependencies);
  const payload = await response.json() as { error: string; reference: string };
  assert.equal(response.status, 502);
  assert.match(payload.error, /خطای داخلی/);
  assert.match(payload.reference, /^[0-9a-f-]{36}$/);
  assert.equal(JSON.stringify(errors).includes('Internal Server Error'), false);
});

test('timeout is distinguished from connection failure', async () => {
  const timeout = new Error('timed out');
  timeout.name = 'TimeoutError';
  const timed = harness(async () => { throw timeout; });
  const timedResponse = await handleCustomerPost(request(), timed.dependencies);
  assert.equal(timedResponse.status, 504);
  assert.match((await timedResponse.json() as { error: string }).error, /طول کشید/);

  const disconnected = harness(async () => { throw new TypeError('fetch failed'); });
  const disconnectedResponse = await handleCustomerPost(request(), disconnected.dependencies);
  assert.equal(disconnectedResponse.status, 503);
  assert.match((await disconnectedResponse.json() as { error: string }).error, /سرویس پردازش/);
});

test('successful non-JSON response is classified as response parsing failure', async () => {
  const { dependencies } = harness(async () => new Response('<html>not json</html>', { status: 200 }));
  const response = await handleCustomerPost(request(), dependencies);
  assert.equal(response.status, 502);
  assert.match((await response.json() as { error: string }).error, /معتبر نبود/);
});
