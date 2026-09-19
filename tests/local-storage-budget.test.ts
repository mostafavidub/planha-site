import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ui = readFileSync('components/admin.tsx', 'utf8');

test('server-backed projects are not duplicated into browser storage', () => {
  assert.match(
    ui,
    /function compactStoreForPersistence[\s\S]*filter\(\(project\) => !project\.engineProjectId\)/,
  );
  assert.match(ui, /localStorage\.setItem\('engi-store', JSON\.stringify\(compact\)\)/);
});

test('a full or unavailable storage backend cannot block login', () => {
  const writer = ui.slice(
    ui.indexOf('function writeStore'),
    ui.indexOf('async function uploadAvatarFile'),
  );
  assert.match(writer, /try \{[\s\S]*localStorage\.setItem/);
  assert.match(writer, /catch \{[\s\S]*localStorage\.removeItem\('engi-store'\)/);
});

test('project migration fingerprint remains bounded', () => {
  assert.match(
    ui,
    /pendingProjects\.map\(\(project\) => \[[\s\S]*project\.id,[\s\S]*project\.engineRevision \|\| 0/,
  );
  assert.doesNotMatch(ui, /const fingerprint = JSON\.stringify\(pendingProjects\);/);
});
