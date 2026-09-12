import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { analyzeProjectFile } from '../lib/dxf-analysis';

const header = `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n`;

test('extracts and totals explicit areas for identified floors from DXF', () => {
  const dxf = `${header}0\nSECTION\n2\nENTITIES\n1\nپلان معماری طبقه همکف\n1\nS=53/70 M\n1\nپلان معماری طبقه اول\n1\nS=53/70 M\n0\nENDSEC\n0\nEOF\n`;
  const result = analyzeProjectFile('project.dxf', strToU8(dxf));
  assert.equal(result.status, 'ready');
  assert.equal(result.area, 107.4);
  assert.equal(result.floors, 2);
  assert.equal(result.unit, 'میلی‌متر');
});

test('opens ZIP packages and ignores roof plans in floor count', () => {
  const dxf = `${header}1\nپلان معماری طبقه همکف\n1\nمساحت 80.25 متر\n1\nپلان شیب بندی بام\n`;
  const archive = zipSync({
    'drawing.dxf': strToU8(dxf),
    '__MACOSX/._drawing.dxf': strToU8('metadata'),
  });
  const result = analyzeProjectFile('project.zip', archive);
  assert.equal(result.status, 'ready');
  assert.equal(result.area, 80.25);
  assert.equal(result.floors, 1);
});

test('blocks pricing when floor and area evidence conflict', () => {
  const dxf = `${header}1\nپلان معماری طبقه همکف\n1\nپلان معماری طبقه اول\n1\nS=53/70 M\n`;
  const result = analyzeProjectFile('project.dxf', strToU8(dxf));
  assert.equal(result.status, 'review');
  assert.equal(result.area, null);
  assert.ok(result.warnings.length > 0);
});

test('requires confirmation for geometry-only floor boundaries', () => {
  const polygon = (x: number) =>
    `0\nLWPOLYLINE\n8\nAREA\n70\n1\n10\n${x}\n20\n0\n10\n${x + 10}\n20\n0\n10\n${x + 10}\n20\n8\n10\n${x}\n20\n8\n`;
  const dxf = `${header}0\nSECTION\n2\nENTITIES\n0\nTEXT\n10\n5\n20\n-2\n1\nپلان معماری طبقه همکف\n0\nTEXT\n10\n25\n20\n-2\n1\nپلان معماری طبقه اول\n${polygon(0)}${polygon(20)}0\nENDSEC\n0\nEOF\n`;
  const result = analyzeProjectFile('geometry.dxf', strToU8(dxf));
  assert.equal(result.status, 'confirm');
  assert.equal(result.area, 160);
  assert.equal(result.method, 'closed-boundary');
});

test('does not use repeated sheet frames as building area', () => {
  const frame = (x: number) =>
    `0\nLWPOLYLINE\n8\nsuport\n70\n1\n10\n${x}\n20\n0\n10\n${x + 21}\n20\n0\n10\n${x + 21}\n20\n29.7\n10\n${x}\n20\n29.7\n`;
  const dxf = `${header}0\nSECTION\n2\nENTITIES\n1\nپلان معماری طبقه همکف\n${frame(0)}${frame(30)}${frame(60)}0\nENDSEC\n0\nEOF\n`;
  const result = analyzeProjectFile('frames.dxf', strToU8(dxf));
  assert.equal(result.status, 'review');
  assert.equal(result.area, null);
});

test('expands floor ranges instead of counting only the first ordinal', () => {
  const dxf = `${header}1\nپلان معماری طبقه همکف\n1\nپلان معماری تیپ طبقات اول تا پنجم\n1\nS=69 M\n`;
  const result = analyzeProjectFile('range.dxf', strToU8(dxf));
  assert.equal(result.floors, 6);
  assert.equal(result.status, 'review');
  assert.equal(result.area, null);
});

test('accepts matching explicit areas even when a floor has repeated sheets', () => {
  const title = (x: number) =>
    `0\nTEXT\n10\n${x}\n20\n-2\n1\nپلان معماری طبقه همکف\n`;
  const dxf = `${header}0\nSECTION\n2\nENTITIES\n${title(5)}${title(35)}1\nS=80 M\n0\nENDSEC\n0\nEOF\n`;
  const result = analyzeProjectFile('duplicates.dxf', strToU8(dxf));
  assert.equal(result.status, 'ready');
  assert.equal(result.area, 80);
  assert.ok(result.warnings.some((warning) => warning.includes('تکراری')));
});

test('extracts reliable design inputs and leaves decisions without evidence unresolved', () => {
  const dxf = `${header}1\nپلان معماری طبقه همکف\n1\nS=80 M\n1\nشهر: مشهد\n1\nارتفاع طبقه: 3.20 متر\n1\nپکیج دیواری و رادیاتور\n1\nفشار آب: 2.5 bar\n1\nپارکینگ بسته\n`;
  const result = analyzeProjectFile('evidence.dxf', strToU8(dxf));
  assert.equal(result.inferredAnswers.location, 'مشهد');
  assert.match(result.inferredAnswers.heights, /3.20/);
  assert.equal(result.inferredAnswers.heating, 'پکیج دیواری و رادیاتور');
  assert.equal(result.inferredAnswers.water_inlet_pressure, '2.5 bar');
  assert.equal(result.inferredAnswers.parking_enclosure, 'پارکینگ بسته/محصور');
  assert.equal(result.inferredAnswers.cooling, undefined);
});
