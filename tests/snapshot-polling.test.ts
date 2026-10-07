import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  ADMIN_VISIBLE_DELAY_MS,
  adaptiveCustomerDelay,
  adminSnapshotFingerprint,
  customerErrorDelay,
  customerSnapshotFingerprint,
  hasActiveCustomerProject,
  shouldRunBackgroundPolling,
} from '../lib/snapshot-polling';

const ui = readFileSync(new URL('../components/admin.tsx', import.meta.url), 'utf8');

function adaptiveRequests(durationMs: number) {
  let elapsed = 0;
  let unchanged = 0;
  let requests = 0;
  while (true) {
    const delay = adaptiveCustomerDelay(unchanged);
    if (elapsed + delay > durationMs) return requests;
    elapsed += delay;
    requests += 1;
    unchanged += 1;
  }
}

test('only genuine non-terminal engine activity enables customer polling', () => {
  assert.equal(hasActiveCustomerProject([]), false);
  assert.equal(
    hasActiveCustomerProject([{ engineProjectId: 1, status: 'تکمیل شده', outputReady: true }]),
    false,
  );
  assert.equal(
    hasActiveCustomerProject([{ engineProjectId: 1, status: 'نیازمند اصلاح' }]),
    false,
  );
  assert.equal(
    hasActiveCustomerProject([{ engineProjectId: 1, status: 'در انتظار پرداخت' }]),
    false,
  );
  assert.equal(
    hasActiveCustomerProject([{ engineProjectId: 1, status: 'در حال پردازش' }]),
    true,
  );
});

test('hidden and offline modes prohibit periodic background polling', () => {
  assert.equal(shouldRunBackgroundPolling({ visible: false, online: true, active: true }), false);
  assert.equal(shouldRunBackgroundPolling({ visible: true, online: false, active: true }), false);
  assert.equal(shouldRunBackgroundPolling({ visible: true, online: true, active: false }), false);
  assert.equal(shouldRunBackgroundPolling({ visible: true, online: true, active: true }), true);
});

test('active cadence backs off and transient errors are bounded', () => {
  assert.deepEqual([0, 1, 2, 3, 20].map(adaptiveCustomerDelay), [5_000, 10_000, 15_000, 30_000, 30_000]);
  assert.deepEqual([1, 2, 3, 4, 20].map(customerErrorDelay), [5_000, 10_000, 20_000, 30_000, 30_000]);
});

test('identical snapshots have identical lightweight fingerprints', () => {
  const customer = { userId: 'CUST-1', balance: 1, projects: [{ id: 'P1' }], transactions: [] };
  assert.equal(customerSnapshotFingerprint(customer), customerSnapshotFingerprint(structuredClone(customer)));
  assert.notEqual(customerSnapshotFingerprint(customer), customerSnapshotFingerprint({ ...customer, balance: 2 }));
  const admin = { users: [{ id: 'CUST-1' }], projects: [], transactions: [] };
  assert.equal(adminSnapshotFingerprint(admin), adminSnapshotFingerprint(structuredClone(admin)));
});

test('deterministic request-count benchmark exceeds the 90 percent idle target', () => {
  const hour = 60 * 60 * 1_000;
  const tenMinutes = 10 * 60 * 1_000;
  const beforeCustomerHour = hour / 4_000;
  const afterTerminalHour = 0;
  const beforeProcessing = tenMinutes / 4_000;
  const afterProcessing = adaptiveRequests(tenMinutes);
  const beforeAdminHour = hour / 10_000;
  const afterAdminVisibleHour = hour / ADMIN_VISIBLE_DELAY_MS;

  assert.deepEqual(
    {
      customerTerminalHour: [beforeCustomerHour, afterTerminalHour],
      customerProcessingTenMinutes: [beforeProcessing, afterProcessing],
      customerHiddenHour: [beforeCustomerHour, 0],
      adminHiddenHour: [beforeAdminHour, 0],
      adminVisibleHour: [beforeAdminHour, afterAdminVisibleHour],
      threeCustomerTabsOnlyOneVisibleTerminalHour: [beforeCustomerHour * 3, 0],
    },
    {
      customerTerminalHour: [900, 0],
      customerProcessingTenMinutes: [150, 22],
      customerHiddenHour: [900, 0],
      adminHiddenHour: [360, 0],
      adminVisibleHour: [360, 60],
      threeCustomerTabsOnlyOneVisibleTerminalHour: [2700, 0],
    },
  );
});

test('customer and admin coordinators use timeout scheduling and lifecycle cleanup', () => {
  assert.doesNotMatch(ui, /setInterval\(syncSession|setInterval\(refresh/);
  assert.match(ui, /document\.hidden/);
  assert.match(ui, /navigator\.onLine/);
  assert.match(ui, /if \(inFlight\) return inFlight/);
  assert.match(ui, /document\.addEventListener\('visibilitychange', lifecycleRefresh\)/);
  assert.match(ui, /document\.removeEventListener\('visibilitychange', lifecycleRefresh\)/);
  assert.match(ui, /window\.addEventListener\('online', lifecycleRefresh\)/);
  assert.match(ui, /window\.addEventListener\('offline', lifecycleRefresh\)/);
  assert.match(ui, /window\.removeEventListener\('offline', lifecycleRefresh\)/);
  assert.match(ui, /window\.addEventListener\('engi-route', lifecycleRefresh\)/);
  assert.match(ui, /fingerprint !== lastFingerprint/);
  assert.match(ui, /reason\.status === 401 \|\| reason\.status === 403/);
});
