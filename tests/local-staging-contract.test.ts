import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../lib/customer-bridge.ts', import.meta.url), 'utf8');

test('local staging uses an explicitly configured local engine', () => {
  assert.match(packageJson.scripts['staging:local'], /PLANHA_LOCAL_ENGINE_URL=http:\/\/127\.0\.0\.1:8080/);
  assert.match(viteConfig, /localVars\.PLANHA_ENGINE_URL = localEngineUrl/);
});

test('local staging supplies a local-only bridge token', () => {
  assert.match(packageJson.scripts['staging:local'], /PLANHA_LOCAL_BRIDGE_TOKEN=/);
  assert.match(viteConfig, /localVars\.PANEL_BRIDGE_TOKEN = localBridgeToken/);
});

test('missing engine configuration fails closed without an online staging fallback', () => {
  assert.doesNotMatch(bridge, /railway\.app|stage\.planha\.com|staging\.planha\.com/);
  assert.match(bridge, /127\.0\.0\.1:0/);
});

test('CI gates do not depend on an online staging endpoint', () => {
  const workflow = readFileSync(new URL('../.github/workflows/site-ci.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(workflow, /railway\.app|stage\.planha\.com|staging\.planha\.com/);
});
