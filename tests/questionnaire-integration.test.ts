import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('project upload obtains the file-specific questionnaire from the central engine', () => {
  const route = readFileSync('lib/project-file-handler.ts', 'utf8');
  assert.match(route, /internal\/panel\/questionnaire\/start/);
  assert.match(route, /internal\/panel\/questionnaire\/\$\{analysisJobId\}/);
  assert.match(route, /analysisJobId: outcome\.jobId/);
  assert.match(route, /discipline=/);
  assert.match(route, /occupancy=/);
  assert.match(route, /questionnaireIdentity/);
  assert.match(route, /engine\.identity/);
  assert.doesNotMatch(route, /engine\.version/);
});

test('customer draft carries the living questionnaire identity without a hand-managed version', () => {
  const panel = readFileSync('components/admin.tsx', 'utf8');
  assert.match(panel, /questionnaireIdentity/);
  assert.doesNotMatch(panel, /questionnaireVersion/);
  assert.doesNotMatch(panel, /5\.1-single-source/);
});

test('user panel renders only questions returned for the uploaded file', () => {
  const panel = readFileSync('components/admin.tsx', 'utf8');
  assert.match(panel, /analysis\?\.questions \|\| \[\]/);
  assert.doesNotMatch(panel, /engineQuestions \|\| questionsForService/);
});

test('questionnaire proxy fails closed instead of serving a divergent local list', () => {
  const route = readFileSync('app/api/questionnaire/route.ts', 'utf8');
  assert.doesNotMatch(route, /questionsForService/);
  assert.match(route, /status: 503/);
});
