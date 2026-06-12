import React, { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

export default function AdminPaymentSettings() {
  const [threshold, setThreshold] = useState('');
  const [inputVal, setInputVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/v1/settings`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        // Value may be stored as JSON string or raw number
        let raw = data.payment_threshold;
        if (raw === undefined || raw === null) {
          raw = 50; // Default
        } else if (typeof raw === 'string') {
          try { raw = JSON.parse(raw); } catch (_) { raw = 50; }
        }
        setThreshold(raw);
        setInputVal(String(raw));
        setLoading(false);
      })
      .catch(() => {
        setThreshold(50);
        setInputVal('50');
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    const parsed = parseFloat(inputVal);
    if (isNaN(parsed) || parsed < 0) {
      setError('Please enter a valid dollar amount (e.g. 50).');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/v1/settings/payment_threshold`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: parsed }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setThreshold(parsed);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px' }}>
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '1rem',
        padding: '2rem',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '1.75rem' }}>💳</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Payment Threshold
            </h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Orders at or above this amount require online payment before entering the kitchen.
            </p>
          </div>
        </div>

        {/* Current value badge */}
        <div style={{
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: '0.75rem',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Current threshold</span>
          <span style={{ color: '#10b981', fontWeight: 700, fontSize: '1.25rem' }}>
            {loading ? '…' : `$${Number(threshold).toFixed(2)}`}
          </span>
        </div>

        {/* How it works */}
        <div style={{
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.18)',
          borderRadius: '0.75rem',
          padding: '1rem 1.25rem',
          marginBottom: '1.75rem',
        }}>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#f59e0b', lineHeight: 1.6 }}>
            <strong>How it works:</strong> When an order total is <strong>≥ this amount</strong>, the system will:
            <br />① Set the order to <em>Awaiting Payment</em>
            <br />② Create a Stripe Checkout link
            <br />③ Automatically text the customer an SMS with the payment link
            <br />④ Move the order to the Incoming Queue only after payment is confirmed
          </p>
        </div>

        {/* Input */}
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          New Threshold Amount ($)
        </label>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{
              position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', fontSize: '1rem', pointerEvents: 'none',
            }}>$</span>
            <input
              id="payment-threshold-input"
              type="number"
              min="0"
              step="0.01"
              value={inputVal}
              onChange={e => { setInputVal(e.target.value); setSaved(false); }}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem 0.875rem 0.75rem 1.75rem',
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${error ? '#f87171' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '0.625rem',
                color: 'var(--text-primary)',
                fontSize: '1rem',
                outline: 'none',
              }}
              placeholder="50"
            />
          </div>
          <button
            id="save-payment-threshold-btn"
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              padding: '0.75rem 1.5rem',
              background: saved ? 'rgba(16,185,129,0.2)' : 'var(--accent-primary)',
              color: saved ? '#10b981' : 'white',
              border: saved ? '1px solid rgba(16,185,129,0.3)' : 'none',
              borderRadius: '0.625rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              minWidth: '100px',
            }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
          </button>
        </div>

        {error && (
          <p style={{ marginTop: '0.5rem', color: '#f87171', fontSize: '0.82rem' }}>{error}</p>
        )}

        {/* Set to $0 tip */}
        <p style={{ marginTop: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          💡 Set to <strong>0</strong> to require payment on <em>all</em> orders, or a very large number (e.g. 9999) to effectively disable payment requirements.
        </p>
      </div>
    </div>
  );
}
