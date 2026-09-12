'use client';
import { useRef, useState } from 'react';

export function WalletAdjustment({ userId }: { userId: string }) {
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState('credit');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef<{fingerprint: string; id: string} | null>(null);
  return <form className="edit-record-form" onSubmit={async e => {
    e.preventDefault(); if (busy) return;
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value <= 0 || !reason.trim()) { setMessage('Enter a positive amount and a reason.'); return; }
    const fingerprint = JSON.stringify([userId, value, kind, reason.trim()]);
    if (pending.current?.fingerprint !== fingerprint) pending.current = {fingerprint, id: crypto.randomUUID()};
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/accounts', {method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'wallet_adjustment', userId, amount:value, kind, reason:reason.trim(), requestId:pending.current.id})});
      const result = await response.json() as {error?: string; detail?: string};
      if (!response.ok) throw new Error(result.detail || result.error || 'Adjustment failed');
      pending.current = null; setAmount(''); setReason(''); setMessage('Adjustment recorded.');
      window.dispatchEvent(new Event('engi-admin-refresh'));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Connection failed'); }
    finally { setBusy(false); }
  }}>
    <h3>Wallet adjustment</h3>
    <label>Type<select value={kind} onChange={e => setKind(e.target.value)} disabled={busy}>
      <option value="credit">Credit</option><option value="debit">Debit</option>
    </select></label>
    <label>Amount (TOMAN)<input type="number" min="1" step="1" required value={amount} onChange={e => setAmount(e.target.value)} disabled={busy}/></label>
    <label>Reason<input required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} disabled={busy}/></label>
    <button type="submit" disabled={busy}>{busy ? 'Recording…' : 'Record adjustment'}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
