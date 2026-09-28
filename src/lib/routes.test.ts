import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_ROUTE, formatRoute, isJobPage, parseRoute, type Route } from './routes.js';

test('parses simple pages', () => {
  assert.deepEqual(parseRoute('#/inventory'), { page: 'inventory' });
  assert.deepEqual(parseRoute('#/referral-associates'), { page: 'referral-associates' });
  assert.deepEqual(parseRoute('#/dashboard/'), { page: 'dashboard' });
});

test('empty app route is the dashboard', () => {
  assert.deepEqual(parseRoute('#/'), DEFAULT_ROUTE);
});

test('parses job routes', () => {
  assert.deepEqual(parseRoute('#/jobs/new'), { page: 'new-job' });
  assert.deepEqual(parseRoute('#/jobs/new?lead=ghl_1_abc'), { page: 'new-job', leadId: 'ghl_1_abc' });
  assert.deepEqual(parseRoute('#/jobs/abc123'), { page: 'edit-job', jobId: 'abc123' });
  assert.deepEqual(parseRoute('#/jobs/abc123/sheet'), { page: 'job-sheet', jobId: 'abc123' });
});

test('rejects hashes that are not app routes', () => {
  assert.equal(parseRoute(''), null);
  assert.equal(parseRoute('#'), null);
  assert.equal(parseRoute('#access_token=xyz&type=recovery'), null);
  assert.equal(parseRoute('#/nope'), null);
  assert.equal(parseRoute('#/new-job'), null);
  assert.equal(parseRoute('#/jobs'), null);
  assert.equal(parseRoute('#/jobs/abc/extra/more'), null);
  assert.equal(parseRoute('#/inventory/extra'), null);
});

test('format and parse round-trip, including ids that need escaping', () => {
  const routes: Route[] = [
    { page: 'dashboard' },
    { page: 'shopping-list' },
    { page: 'new-job' },
    { page: 'new-job', leadId: 'lead with spaces&stuff' },
    { page: 'edit-job', jobId: 'id/with?chars#' },
    { page: 'job-sheet', jobId: 'k3j2h1' },
  ];
  for (const route of routes) {
    assert.deepEqual(parseRoute(formatRoute(route)), route);
  }
});

test('job routes without an id fall back to the dashboard', () => {
  assert.equal(formatRoute({ page: 'edit-job' }), '#/dashboard');
  assert.equal(formatRoute({ page: 'job-sheet' }), '#/dashboard');
});

test('identifies job pages', () => {
  assert.equal(isJobPage('new-job'), true);
  assert.equal(isJobPage('edit-job'), true);
  assert.equal(isJobPage('job-sheet'), true);
  assert.equal(isJobPage('dashboard'), false);
});
