import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { pollQuestionnaireJob } from '../lib/questionnaire-job';

test('202 processing retains the exact job id and polls until ready', async () => {
  const jobId = '0123456789abcdef0123456789abcdef';
  let reads = 0;
  const pendingIds: string[] = [];
  type Job = {
    analysisPending: boolean;
    analysisJobId: string;
    analysis?: { status: string };
  };
  const result = await pollQuestionnaireJob<Job>(
    { analysisPending: true, analysisJobId: jobId },
    async (current) => {
      reads += 1;
      return reads < 2
        ? current
        : { ...current, analysisPending: false, analysis: { status: 'ready' } };
    },
    (current) => { pendingIds.push(current.analysisJobId || ''); },
    async () => {},
    { maxAttempts: 3, intervalMs: 0 },
  );

  assert.equal(result.analysisJobId, jobId);
  assert.deepEqual(result.analysis, { status: 'ready' });
  assert.equal(reads, 2);
  assert.deepEqual(pendingIds, [jobId, jobId]);
});

test('site retains the job id in draft and rejects legacy finalization locally', () => {
  const ui = readFileSync(new URL('../components/admin.tsx', import.meta.url), 'utf8');
  assert.match(ui, /analysisJobId: current\.analysisJobId/);
  assert.match(ui, /analysisJobId: upload\?\.analysisJobId/);
  assert.match(ui, /تحلیل این فایل قدیمی یا ناقص است/);
  assert.match(ui, /resumeProject\.analysisJobId/);
});

test('bridge credentials and browser analysis never become finalization authority', () => {
  const ui = readFileSync(new URL('../components/admin.tsx', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../app/api/design-project/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /PANEL_BRIDGE_TOKEN|x-panel-token/);
  assert.match(route, /PANEL_BRIDGE_TOKEN/);
  assert.match(route, /analysis_job_id/);
  assert.doesNotMatch(route, /form\.append\('analysis'/);
});
