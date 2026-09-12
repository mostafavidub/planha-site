import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ui = readFileSync('components/admin.tsx', 'utf8');

test('returning phone login replaces the legacy shell with the server identity', () => {
  const login = ui.slice(ui.indexOf('function LoginSafe'), ui.indexOf('function Shell'));
  assert.match(login, /normalize\(user\.mobile\) !== mobile/);
  assert.match(login, /existing\.id !== id/);
  assert.match(login, /project\.owner === legacyId \? \{ \.\.\.project, owner: id \}/);
  assert.match(login, /wallet: server\.balance/);
  assert.doesNotMatch(login, /wallet:\s*existing\?\.wallet/);
});

test('customer projects synchronize with the server source of truth', () => {
  assert.match(ui, /customerRequest\('state'\)[\s\S]*setSession\([\s\S]*customerRequest\('import', \{ projects: pendingProjects \}\)/);
  assert.match(ui, /engi-project-sync:\$\{result\.userId\}/);
  assert.match(ui, /localUserId === 'CUST-27'[\s\S]*projects: localStore\.projects\.map/);
  assert.match(ui, /localStorage\.setItem\(repairKey, '1'\)/);
  assert.match(ui, /const incoming = \(payload\.projects \|\| \[\]\)\.map\(customerProject\)/);
  assert.match(ui, /current\.projects\.filter\(p => !incoming\.some/);
  assert.doesNotMatch(ui, /filter\(\(row: any\) => row\.paid\)\.map\(customerProject\)/);
});

test('login navigation is not blocked by project migration', () => {
  const login = ui.slice(ui.indexOf('function LoginSafe'), ui.indexOf('function Shell'));
  assert.match(login, /applyCustomerState\(server\)[\s\S]*window\.location\.replace/);
  assert.doesNotMatch(login, /await customerRequest\('import'/);
});

test('legacy browser passwords cannot block direct phone login', () => {
  const login = ui.slice(ui.indexOf('function LoginSafe'), ui.indexOf('function Shell'));
  assert.match(login, /setEntering\(true\)[\s\S]*customerRequest\('session', \{ phone: mobile \}\)/);
  assert.match(login, /disabled=\{entering\}/);
  assert.doesNotMatch(login, /engi-user-password/);
  assert.doesNotMatch(login, /passwordRequired/);
});

test('legacy projects without engine state cannot crash authenticated login', () => {
  assert.match(ui, /function mergeEngineState\(project: Project, state\?: EngineProjectState\)/);
  assert.match(ui, /state = state \|\| \(\{\} as EngineProjectState\)/);
  assert.match(ui, /function customerProject\(row: any\)[\s\S]*row\.engine/);
});

test('a valid server session cannot be trapped on the login URL', () => {
  assert.match(ui, /if \(!admin && !auth && !acting\) return <LoginSafe \/>/);
  assert.doesNotMatch(ui, /!auth \|\| page === 'login'/);
});

test('durable projects keep their stored status when no engine state exists', () => {
  assert.match(ui, /const hasEngineState = Object\.keys\(state\)\.length > 0/);
  assert.match(ui, /!hasEngineState[\s\S]*\? project\.status/);
  assert.match(ui, /const outputReady = hasEngineState/);
  assert.match(ui, /Boolean\(project\.outputReady \|\| project\.status === 'تکمیل شده'\)/);
});

test('server project fields override customer-card defaults', () => {
  assert.match(
    ui,
    /\{ date: 'امروز', status: 'در حال پردازش', progress: 0, \.\.\.row \}/,
  );
  assert.doesNotMatch(
    ui,
    /\{ \.\.\.row, date: 'امروز', status: 'در حال پردازش', progress: 0 \}/,
  );
});
