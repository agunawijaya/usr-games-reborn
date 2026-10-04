// The settings' defaults, and the Fluent nod in the career and on the report.
// Run: node --test tests/settings.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FLUENT_ORDERS, newCareer, withTypedOrders } from '../src/career.js';
import { reportLines } from '../src/report.js';
import { newService, withShift } from '../src/service.js';
import {
  newSettings, nextTextSize, orderButtonsOn, TYPED_ORDERS_FOR_BUTTONS_OFF, typedOrders, withDefaults,
} from '../src/settings.js';

test('order buttons start on for a new career', () => {
  assert.equal(orderButtonsOn(newSettings(), newService()), true);
});

test('order buttons start off once the record shows fifty orders typed by hand', () => {
  const seasoned = { ...newService(), orders: TYPED_ORDERS_FOR_BUTTONS_OFF + 10, buttonOrders: 10 };
  assert.equal(typedOrders(seasoned), TYPED_ORDERS_FOR_BUTTONS_OFF);
  assert.equal(orderButtonsOn(newSettings(), seasoned), false);
  const mostlyButtons = { ...newService(), orders: 200, buttonOrders: 160 };
  assert.equal(orderButtonsOn(newSettings(), mostlyButtons), true, 'orders given with the buttons do not count');
});

test('a record saved before the buttons existed counts every order as typed', () => {
  const old = { ...newService(), orders: 80 };
  delete old.buttonOrders;
  assert.equal(orderButtonsOn(newSettings(), old), false);
});

test('the controller’s own choice wins over the default, either way', () => {
  const seasoned = { ...newService(), orders: 500 };
  assert.equal(orderButtonsOn({ ...newSettings(), orderButtons: true }, seasoned), true);
  assert.equal(orderButtonsOn({ ...newSettings(), orderButtons: false }, newService()), false);
});

test('a damaged save falls back to the defaults, field by field', () => {
  assert.deepEqual(withDefaults(null), newSettings());
  assert.deepEqual(withDefaults({ orderButtons: 'yes', textSize: 'huge', reference: 1, tipsDone: ['select', 'nonsense'] }), {
    ...newSettings(),
    tipsDone: ['select'],
  });
  assert.deepEqual(withDefaults({ orderButtons: false, textSize: 'large', reference: true, tipsDone: [] }), {
    orderButtons: false,
    textSize: 'large',
    reference: true,
    tipsDone: [],
  });
});

test('the reference card starts closed, the radar text at Standard, and Alt+T goes round the sizes', () => {
  assert.equal(newSettings().reference, false);
  assert.equal(newSettings().textSize, 'standard');
  assert.equal(nextTextSize('standard'), 'large');
  assert.equal(nextTextSize('large'), 'xlarge');
  assert.equal(nextTextSize('xlarge'), 'standard');
});

test('the service record keeps the orders given with the buttons apart', () => {
  const summary = {
    mode: 'open', dateKey: '2026-10-02', sectorName: 'Easy', assignment: null, daily: null, safe: 2, landings: 1,
    exits: 1, takeoffs: 0, orders: 12, buttonOrders: 7, refused: 0, seconds: 120, ended: 'lost', lostPlane: 'a',
    lostReason: 'lost separation with b', tasks: [], rank: { title: 'Trainee', promoted: false, next: null },
  };
  const record = withShift(newService(), summary, 'easy');
  assert.equal(record.orders, 12);
  assert.equal(record.buttonOrders, 7);
  assert.equal(typedOrders(record), 5);
});

test('Fluent: fifty orders typed by hand in one shift, earned once and kept', () => {
  const career = newCareer();
  assert.equal(withTypedOrders(career, FLUENT_ORDERS - 1, '2026-10-02'), career);
  const fluent = withTypedOrders(career, FLUENT_ORDERS, '2026-10-02');
  assert.equal(fluent.fluent, '2026-10-02');
  assert.equal(withTypedOrders(fluent, 80, '2026-10-03').fluent, '2026-10-02');
});

test('the report prints the Fluent line on the shift that earned it', () => {
  const summary = {
    mode: 'open', dateKey: '2026-10-02', sectorName: 'Default', assignment: null, daily: null, safe: 9, landings: 3,
    exits: 6, takeoffs: 1, orders: 55, buttonOrders: 0, fluent: true, refused: 1, seconds: 600, ended: 'lost',
    lostPlane: 'k', lostReason: 'fuel exhausted, diverted', tasks: [{ text: 'Land 2 planes', done: true }],
    rank: { title: 'Trainee', promoted: false, next: null },
  };
  const lines = reportLines(summary).map((line) => line.text);
  assert.ok(lines.includes('FLUENT · 50 ORDERS TYPED BY HAND'));
  assert.ok(lines.every((line) => line.length <= 44), 'every line fits the paper');
  assert.ok(!reportLines({ ...summary, fluent: false }).some((line) => line.text.startsWith('FLUENT')));
});
