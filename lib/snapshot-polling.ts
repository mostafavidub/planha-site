export const CUSTOMER_ACTIVE_DELAYS_MS = [5_000, 10_000, 15_000, 30_000] as const;
export const CUSTOMER_ERROR_DELAYS_MS = [5_000, 10_000, 20_000, 30_000] as const;
export const ADMIN_VISIBLE_DELAY_MS = 60_000;
export const LIFECYCLE_REFRESH_STALE_MS = 3_000;

type PollableProject = {
  status?: string;
  engineProjectId?: number;
  outputReady?: boolean;
};

const ACTIVE_CUSTOMER_STATUSES = new Set(['در حال بررسی', 'در حال پردازش']);

export function hasActiveCustomerProject(projects: PollableProject[]) {
  return projects.some(
    (project) =>
      Boolean(project.engineProjectId) &&
      !project.outputReady &&
      ACTIVE_CUSTOMER_STATUSES.has(project.status || ''),
  );
}

export function adaptiveCustomerDelay(unchangedResponses: number) {
  return CUSTOMER_ACTIVE_DELAYS_MS[
    Math.min(Math.max(unchangedResponses, 0), CUSTOMER_ACTIVE_DELAYS_MS.length - 1)
  ];
}

export function customerErrorDelay(consecutiveErrors: number) {
  return CUSTOMER_ERROR_DELAYS_MS[
    Math.min(Math.max(consecutiveErrors - 1, 0), CUSTOMER_ERROR_DELAYS_MS.length - 1)
  ];
}

export function shouldRunBackgroundPolling({
  visible,
  online,
  active,
}: {
  visible: boolean;
  online: boolean;
  active: boolean;
}) {
  return visible && online && active;
}

export function customerSnapshotFingerprint(payload: {
  userId?: string;
  balance?: number;
  projects?: unknown[];
  transactions?: unknown[];
}) {
  return JSON.stringify([
    payload.userId || '',
    payload.balance ?? null,
    payload.projects || [],
    payload.transactions || [],
  ]);
}

export function adminSnapshotFingerprint(payload: {
  users?: unknown[];
  projects?: unknown[];
  transactions?: unknown[];
}) {
  return JSON.stringify([
    payload.users || [],
    payload.projects || [],
    payload.transactions || [],
  ]);
}
