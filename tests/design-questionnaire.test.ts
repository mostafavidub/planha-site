import assert from 'node:assert/strict';
import test from 'node:test';
import { questionsForService } from '../lib/design-questionnaire';

test('mechanical questionnaire exposes every critical engine input', () => {
  const ids = new Set(questionsForService('طراحی مکانیک').map((q) => q.id));
  for (const id of [
    'has_gas_system',
    'has_boiler_room',
    'has_pool',
    'has_sauna',
    'has_jacuzzi',
    'location',
    'heating',
    'cooling',
    'water_source',
    'water_inlet_pressure',
    'gas',
    'gas_service_pressure',
    'sanitary_outlet',
    'ventilation_design_basis',
    'mechanical_shaft_route',
    'equipment_schedule',
    'local_mechanical_code',
  ])
    assert.equal(ids.has(id), true, id);
});

test('electrical questionnaire uses engine-compatible keys and usable options', () => {
  const questions = questionsForService('طراحی برق');
  const ids = new Set(questions.map((q) => q.id));
  for (const id of [
    'location',
    'supply',
    'main_panel',
    'emergency',
    'elevator',
    'loads',
    'lighting',
    'power',
    'elv',
    'fire_alarm',
    'earthing',
  ])
    assert.equal(ids.has(id), true, id);
  for (const question of questions.filter(
    (q) => q.type === 'select' && q.group === 'ورودی‌های فنی موتور طراحی',
  ))
    assert.ok((question.options?.length || 0) >= 4, question.id);
});

test('scope questions use stable engine keys instead of presentation indexes', () => {
  const ids = questionsForService('طراحی مکانیک').map(
    (question) => question.id,
  );
  assert.ok(ids.includes('has_gas_system'));
  assert.ok(ids.includes('has_boiler_room'));
  assert.ok(ids.includes('has_pool'));
  assert.ok(ids.includes('has_sauna'));
  assert.ok(ids.includes('has_jacuzzi'));
  assert.equal(
    ids.some((id) => id.startsWith('order_need_')),
    false,
  );
});
