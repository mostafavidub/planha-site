import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ui = readFileSync(new URL('../components/admin.tsx', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../app/api/design-project/route.ts', import.meta.url), 'utf8');
const output = readFileSync(new URL('../app/api/design-project/output/route.ts', import.meta.url), 'utf8');

test('payment delegates the debit and queue to authoritative server checkout', () => {
  const pay = ui.slice(ui.indexOf("async function pay(method"), ui.indexOf('const manualAreaPanel'));
  assert.match(pay, /customerRequest\('pay'/);
  assert.match(pay, /customerRequest\('quote'/);
  assert.doesNotMatch(pay, /wallet\s*[-+]=|wallet\s*:\s*.*wallet\s*-/);
  assert.match(pay, /applyCustomerState/);
  assert.match(pay, /progress:\s*0/);
  assert.doesNotMatch(pay, /method === 'wallet' \? 10 : 5/);
});

test('price estimation visibly waits and safely retries a transient project start', () => {
  assert.match(ui, /async function startDesignProjectWithRetry/);
  assert.match(ui, /startDesignProjectWithRetry\(draft\)/);
  assert.match(ui, /disabled=\{busy\} aria-busy=\{busy\}/);
  assert.match(ui, /در حال محاسبه قیمت…/);
});

test('customer project rows open an accessible progress dialog', () => {
  assert.match(ui, /className=\{on \? 'project-row-clickable'/);
  assert.match(ui, /role=\{on \? 'button'/);
  assert.match(ui, /function ProjectProgressDialog/);
  assert.match(ui, /on=\{\(project\) => setSelectedId\(project\.id\)\}/);
});

test('progress is polled from persisted engine milestones instead of simulated', () => {
  assert.match(ui, /action:\s*'status'/);
  assert.match(ui, /progress\?\.percent \?\? state\.progress/);
  assert.match(ui, /window\.setInterval\(syncSession, 4000\)/);
  assert.doesNotMatch(ui, /Promise\.allSettled\(active\.map\(readDesignProjectState\)\)/);
  assert.ok(!ui.includes('setInterval(() => setProgress(progress +'));
});

test('completed output always renders as 100 percent in panel and admin rows', () => {
  assert.match(ui, /const outputReady = hasEngineState/);
  assert.match(ui, /progress: outputReady \? 100/);
  assert.match(ui, /outputReady,/);
});

test('stale and same-revision snapshots cannot decrease project progress', () => {
  assert.match(ui, /function reconcileProjectSnapshot/);
  assert.match(ui, /if \(incomingRevision < currentRevision\) return current/);
  assert.match(ui, /Math\.max\(current\.progress, incoming\.progress\)/);
  assert.match(ui, /incomingRevision > currentRevision/);
});

test('download is available only after the engine marks output ready', () => {
  assert.match(ui, /project\.outputReady \|\| project\.status === 'تکمیل شده'/);
  assert.match(ui, /className="project-download-button"/);
  assert.match(ui, /دانلود خروجی پروژه/);
  assert.match(ui, /fetch\('\/api\/design-project\/output'/);
  assert.match(output, /x-project-token/);
  assert.match(output, /cache-control', 'private, no-store'/);
});

test('server bridge keeps service credentials and stored files off the browser', () => {
  assert.match(bridge, /PANEL_BRIDGE_TOKEN/);
  assert.match(bridge, /env\.FILES/);
  assert.match(bridge, /x-panel-token/);
  assert.doesNotMatch(ui, /PANEL_BRIDGE_TOKEN|x-panel-token/);
});

test('failed projects refresh on dialog open and always render a visible reason', () => {
  const dialog = ui.slice(
    ui.indexOf('function ProjectProgressDialog'),
    ui.indexOf('function Simple'),
  );
  assert.match(dialog, /readDesignProjectState\(project\)/);
  assert.match(dialog, /project\.status === 'نیازمند اصلاح'/);
  assert.match(dialog, /role="alert"/);
  assert.match(ui, /state\.failure\?\.message/);
});
