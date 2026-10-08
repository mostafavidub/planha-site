import assert from 'node:assert/strict';
import test from 'node:test';

import {
  handleProjectFileRequest,
  type ProjectFileDependencies,
} from '../lib/project-file-handler';

const userId = 'customer-1';
const jobId = '0123456789abcdef0123456789abcdef';
const key = `projects/${userId}/source.dxf`;

function request(fields: Record<string, string>, file?: File) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  if (file) form.append('file', file);
  return new Request('http://site.local/api/project-file', {
    method: 'POST', headers: { origin: 'http://site.local' }, body: form,
  });
}

function questionnaire(status: 'processing' | 'ready' | 'failed') {
  if (status === 'processing') return { status, job_id: jobId };
  if (status === 'failed') return { status, job_id: jobId, error: 'engine failed safely' };
  return {
    status, job_id: jobId,
    result: {
      identity: 'questionnaire-v1', source: 'engine', questions: [],
      inferred_answers: {}, panel_analysis: {
        status: 'ready', area: 10, floors: 1, floorAreas: [], unit: 'm2',
        confidence: 1, method: 'explicit-text', warnings: [], evidence: [], checks: [],
      },
    },
  };
}

function harness(options: {
  sessionUser?: string;
  questionnaireStatus?: 'processing' | 'ready' | 'failed';
} = {}) {
  const calls = { get: 0, put: 0, arrayBuffer: 0, urls: [] as string[], startBodies: [] as FormData[] };
  const dependencies: ProjectFileDependencies = {
    engine: 'http://engine.local',
    files: {
      async get() {
        calls.get += 1;
        return {
          async arrayBuffer() {
            calls.arrayBuffer += 1;
            return new TextEncoder().encode('stored dxf').buffer;
          },
          customMetadata: { originalName: encodeURIComponent('source.dxf') },
          httpMetadata: { contentType: 'application/dxf' },
        };
      },
      async put() { calls.put += 1; },
    },
    bridgeHeaders: () => ({
      'content-type': 'application/json', 'x-panel-token': 'local-token',
      'x-customer-session': 'local-session', accept: 'application/json',
    }),
    sameOrigin: () => true,
    fetcher: (async (input, init) => {
      const url = String(input);
      calls.urls.push(url);
      if (url.endsWith('/internal/panel/customer/state'))
        return Response.json({ userId: options.sessionUser ?? userId });
      if (url.includes('/internal/panel/questionnaire/start')) {
        assert.equal(init?.method, 'POST');
        assert.ok(init?.body instanceof FormData);
        calls.startBodies.push(init.body);
        return Response.json(questionnaire('processing'), { status: 202 });
      }
      if (url.endsWith(`/internal/panel/questionnaire/${jobId}`)) {
        assert.equal(init?.method, undefined);
        assert.equal(init?.body, undefined);
        return Response.json(questionnaire(options.questionnaireStatus ?? 'processing'), {
          status: options.questionnaireStatus === 'ready' ? 200 : 202,
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch,
  };
  return { dependencies, calls };
}

test('initial analysis stores and uploads the file exactly once', async () => {
  const { dependencies, calls } = harness();
  const response = await handleProjectFileRequest(request(
    { userId, discipline: 'mechanical', occupancy: 'residential' },
    new File(['minimal dxf'], 'source.dxf', { type: 'application/dxf' }),
  ), dependencies);
  assert.equal(response.status, 202);
  assert.equal(calls.put, 1);
  assert.equal(calls.get, 0);
  assert.equal(calls.arrayBuffer, 0);
  assert.equal(calls.startBodies.length, 1);
  assert.ok(calls.startBodies[0].get('file') instanceof File);
});

test('polling passes the exact job id without reading or uploading R2 data', async () => {
  const { dependencies, calls } = harness();
  const response = await handleProjectFileRequest(request({
    userId, key, name: 'source.dxf', size: '1048576', analysisJobId: jobId,
  }), dependencies);
  const payload = await response.json() as { analysisJobId: string };
  assert.equal(response.status, 202);
  assert.equal(payload.analysisJobId, jobId);
  assert.equal(calls.get, 0);
  assert.equal(calls.put, 0);
  assert.equal(calls.arrayBuffer, 0);
  assert.equal(calls.startBodies.length, 0);
  assert.deepEqual(calls.urls, [
    'http://engine.local/internal/panel/customer/state',
    `http://engine.local/internal/panel/questionnaire/${jobId}`,
  ]);
});

test('owner mismatch fails before R2 or questionnaire access for upload and polling', async () => {
  const requests: Array<{ fields: Record<string, string>; file?: File }> = [
    {
      fields: { userId },
      file: new File(['minimal dxf'], 'source.dxf', { type: 'application/dxf' }),
    },
    { fields: { userId, key, analysisJobId: jobId } },
  ];
  for (const item of requests) {
    const { dependencies, calls } = harness({ sessionUser: 'another-customer' });
    const response = await handleProjectFileRequest(request(item.fields, item.file), dependencies);
    assert.equal(response.status, 403);
    assert.equal(calls.get, 0);
    assert.equal(calls.put, 0);
    assert.equal(calls.arrayBuffer, 0);
    assert.deepEqual(calls.urls, ['http://engine.local/internal/panel/customer/state']);
  }
});

test('malformed job id fails locally before R2 or questionnaire fetch', async () => {
  const { dependencies, calls } = harness();
  const response = await handleProjectFileRequest(request({
    userId, key, analysisJobId: '../questionnaire/start',
  }), dependencies);
  assert.equal(response.status, 400);
  assert.equal(calls.get, 0);
  assert.equal(calls.put, 0);
  assert.equal(calls.arrayBuffer, 0);
  assert.deepEqual(calls.urls, ['http://engine.local/internal/panel/customer/state']);
});

test('polling preserves processing, ready, and terminal failure semantics', async () => {
  for (const [status, expected] of [
    ['processing', 202], ['ready', 200], ['failed', 422],
  ] as const) {
    const { dependencies, calls } = harness({ questionnaireStatus: status });
    const response = await handleProjectFileRequest(request({ userId, key, analysisJobId: jobId }), dependencies);
    assert.equal(response.status, expected);
    assert.equal(calls.get, 0);
    assert.equal(calls.put, 0);
    assert.equal(calls.arrayBuffer, 0);
  }
});
