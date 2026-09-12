'use client';

import { lazy, Suspense } from 'react';

const UserPortal = lazy(() =>
  import('@/components/admin').then((module) => ({
    default: module.UserPortal,
  })),
);

export default function PanelEntry() {
  return (
    <Suspense
      fallback={
        <div className="entry-loading" aria-label="در حال آماده‌سازی پنل" />
      }
    >
      <UserPortal />
    </Suspense>
  );
}
