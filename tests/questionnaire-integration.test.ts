import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('project upload obtains the file-specific questionnaire from the central engine', () => {
  const route = readFileSync('app/api/project-file/route.ts', 'utf8');
  assert.match(route, /api\/questionnaire\/analyze/);
  assert.match(route, /discipline=/);
  assert.match(route, /occupancy=/);
  assert.match(route, /questionnaireVersion/);
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
