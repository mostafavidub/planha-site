'use client';

import { lazy, Suspense, useEffect, useState } from 'react';

const AdminPortal = lazy(() =>
  import('@/components/admin').then((module) => ({
    default: module.AdminPortal,
  })),
);

export default function AdminEntry() {
  const [status, setStatus] = useState<'loading' | 'guest' | 'authenticated'>(
    'loading',
  );
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/admin/session', { cache: 'no-store' })
      .then((response) => response.json())
      .then((result) =>
        setStatus(result && typeof result === 'object' && 'authenticated' in result && result.authenticated ? 'authenticated' : 'guest'),
      )
      .catch(() => setStatus('guest'));
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          password: password.trim(),
        }),
      });
      if (!response.ok) {
        if (response.status >= 500) throw new Error('server');
        throw new Error('credentials');
      }
      setStatus('authenticated');
      window.history.replaceState({}, '', '/admin/users');
      window.dispatchEvent(new Event('engi-route'));
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === 'server'
          ? 'The login service is temporarily unavailable. Please try again.'
          : 'Phone number or password is incorrect.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading')
    return (
      <div className="entry-loading" aria-label="Loading admin interface" />
    );
  if (status === 'guest')
    return (
      <main className="admin-login" dir="ltr">
        <form onSubmit={login}>
          <div className="admin-login-brand">
            <span>ET</span>
            <div>
              <b>EngiTools</b>
              <small>ADMIN CONTROL CENTER</small>
            </div>
          </div>
          <p className="eyebrow">SECURE ADMIN ACCESS</p>
          <h1>Sign in</h1>
          <p>Enter the super administrator credentials to continue.</p>
          <label>
            Mobile number
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              autoComplete="username"
              placeholder="09xxxxxxxxx"
            />
          </label>
          <label>
            Password
            <span className="admin-password-field">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </span>
          </label>
          {error && <div className="admin-login-error">{error}</div>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in to Admin'}
          </button>
        </form>
      </main>
    );
  return (
    <Suspense
      fallback={
        <div className="entry-loading" aria-label="Loading admin interface" />
      }
    >
      <AdminPortal />
    </Suspense>
  );
}
