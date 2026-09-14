'use client';

import { useEffect, useState } from 'react';
import AdminEntry from '@/components/admin-entry';
import PanelEntry from '@/components/panel-entry';

export default function DomainEntry() {
  const [surface, setSurface] = useState<'admin' | 'panel' | 'loading'>('loading');

  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (host === 'admin.planha.com') setSurface('admin');
    else if (host === 'panel.planha.com') setSurface('panel');
    else window.location.replace('/panel/login');
  }, []);

  if (surface === 'admin') return <AdminEntry />;
  if (surface === 'panel') return <PanelEntry />;
  return <div className="entry-loading" aria-label="در حال آماده‌سازی پنل" />;
}
