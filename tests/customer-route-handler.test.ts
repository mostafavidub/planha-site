import assert from 'node:assert/strict';
import test from 'node:test';

import { handleCustomerRequest } from '../lib/customer-route-handler';

function request(action = 'pay') {
  return new Request('http://localhost/api/customer', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }),
  });
}

function dependencies(fetcher: typeof fetch) {
  return {
    engine: 'http://127.0.0.1:18081', customerCookie: 'planha_customer',
    bridgeHeaders: () => ({ 'x-panel-token': 'local', 'x-customer-session': 'session' }),
    sameOrigin: () => true, fetcher,
  };
}

async function forward(status: number, body: BodyInit | null, contentType = 'application/json') {
  const fetcher = async () => new Response(body, { status, headers: { 'content-type': contentType } });
  return handleCustomerRequest(request(), dependencies(fetcher as typeof fetch));
}

test('structured engineering errors retain status, code and Persian message', async () => {
  for (const status of [409, 422]) {
    const response = await forward(status, JSON.stringify({
      error_code: 'ENGINEERING_INPUT_REQUIRED', error: 'اطلاعات معتبر طبقات معماری کافی نیست.',
    }));
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), {
      error_code: 'ENGINEERING_INPUT_REQUIRED', error: 'اطلاعات معتبر طبقات معماری کافی نیست.',
    });
  }
});

test('authentication and authorization failures are not relabeled as network errors', async () => {
  const unauthorized = await forward(401, JSON.stringify({ detail: 'نشست ورود منقضی شده است.' }));
  const forbidden = await forward(403, JSON.stringify({ detail: 'Not Found' }));
  assert.equal(unauthorized.status, 401);
  assert.match(String(((await unauthorized.json()) as Record<string, unknown>).error), /نشست/);
  assert.equal(forbidden.status, 403);
  assert.equal(((await forbidden.json()) as Record<string, unknown>).error, 'Not Found');
});

test('JSON and non-JSON internal failures remain 500 with safe messages', async () => {
  const jsonFailure = await forward(500, JSON.stringify({
    error_code: 'DRAWING_MANIFEST_CONTRACT_ERROR', error: 'قرارداد مجموعه نقشه‌ها معتبر نشد.',
  }));
  assert.equal(jsonFailure.status, 500);
  assert.equal(((await jsonFailure.json()) as Record<string, unknown>).error_code, 'DRAWING_MANIFEST_CONTRACT_ERROR');

  const htmlFailure = await forward(500, '<html>private traceback</html>', 'text/html');
  assert.equal(htmlFailure.status, 500);
  const payload = await htmlFailure.json() as Record<string, unknown>;
  assert.match(String(payload.error), /پردازش داخلی/);
  assert.doesNotMatch(JSON.stringify(payload), /private traceback/);
});

test('only an unreachable backend becomes 503 BACKEND_UNAVAILABLE', async () => {
  const fetcher = async () => { throw new Error('connect ECONNREFUSED 127.0.0.1'); };
  const response = await handleCustomerRequest(request(), dependencies(fetcher as typeof fetch));
  assert.equal(response.status, 503);
  const payload = await response.json() as Record<string, unknown>;
  assert.equal(payload.error_code, 'BACKEND_UNAVAILABLE');
  assert.match(String(payload.error), /ارتباط با سرور/);
  assert.doesNotMatch(JSON.stringify(payload), /ECONNREFUSED/);
});

test('successful session response still sets the HttpOnly customer cookie', async () => {
  const response = await forward(200, JSON.stringify({ session: 'signed-session', userId: 'CUST-1' }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie') || '', /planha_customer=signed-session/);
  assert.deepEqual(await response.json(), { userId: 'CUST-1' });
});
