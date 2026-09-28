import type { AppPage } from './permissions.js';

/**
 * Hash-based URLs for the app's screens, e.g. `#/inventory` or `#/jobs/abc123`.
 * Hash URLs work on GitHub Pages (a static host with no rewrite rules) and give
 * the browser back/forward buttons and shareable links to a screen.
 */
export interface Route {
  page: AppPage;
  /** Job being edited or viewed (edit-job, job-sheet) */
  jobId?: string;
  /** Lead a new job is being created from (new-job) */
  leadId?: string;
}

export const DEFAULT_ROUTE: Route = { page: 'dashboard' };

/** Pages addressed directly by name: `#/<page>` */
const SIMPLE_PAGES: readonly AppPage[] = [
  'dashboard',
  'chip-systems',
  'chip-blends',
  'laborers',
  'costs',
  'pricing',
  'settings',
  'inventory',
  'shopping-list',
  'calendar',
  'reporting',
  'leads',
  'customers',
  'referral-associates',
  'products',
  'organization',
  'backup',
];

/** Screens that belong to a single job; moving between them replaces history */
export function isJobPage(page: AppPage): boolean {
  return page === 'new-job' || page === 'edit-job' || page === 'job-sheet';
}

/**
 * Parse `location.hash`. Returns null for anything that isn't an app route
 * (including hashes that aren't ours, such as auth callback fragments), so the
 * caller can fall back to the default screen without rewriting them.
 */
export function parseRoute(hash: string): Route | null {
  if (!hash.startsWith('#/')) return null;

  const [pathPart, queryPart = ''] = hash.slice(2).split('?');
  const segments = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const query = new URLSearchParams(queryPart);

  if (segments.length === 0) return DEFAULT_ROUTE;

  const [first, second, third] = segments;

  if (first === 'jobs') {
    if (second === 'new' && segments.length === 2) {
      const leadId = query.get('lead');
      return leadId ? { page: 'new-job', leadId } : { page: 'new-job' };
    }
    if (second && segments.length === 2) return { page: 'edit-job', jobId: second };
    if (second && third === 'sheet' && segments.length === 3) return { page: 'job-sheet', jobId: second };
    return null;
  }

  if (segments.length === 1 && (SIMPLE_PAGES as readonly string[]).includes(first)) {
    return { page: first as AppPage };
  }

  return null;
}

/** Build the hash for a route. Routes missing a required id fall back to the dashboard. */
export function formatRoute(route: Route): string {
  switch (route.page) {
    case 'new-job':
      return route.leadId ? `#/jobs/new?lead=${encodeURIComponent(route.leadId)}` : '#/jobs/new';
    case 'edit-job':
      return route.jobId ? `#/jobs/${encodeURIComponent(route.jobId)}` : '#/dashboard';
    case 'job-sheet':
      return route.jobId ? `#/jobs/${encodeURIComponent(route.jobId)}/sheet` : '#/dashboard';
    default:
      return `#/${route.page}`;
  }
}
