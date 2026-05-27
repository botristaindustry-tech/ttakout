import React from 'react';
import { useSearchParams } from 'react-router-dom';

export default function Login() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/auth/google`;
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw' }}>
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '420px', width: '100%' }}>
        <h1 className="text-gradient" style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>TTAKOUT Hub</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Order aggregator and kitchen display system.
        </p>

        {error === 'unauthorized' && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            marginBottom: '1.5rem',
            textAlign: 'left'
          }}>
            <p style={{ color: 'var(--status-critical)', fontWeight: 600, marginBottom: '0.25rem' }}>
              ⛔ Access Denied
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Your email is not authorized to access this system. Please contact your administrator to request access.
            </p>
          </div>
        )}

        <button 
          className="btn btn-primary" 
          style={{ width: '100%', padding: '1rem', fontSize: '1rem' }} 
          onClick={handleGoogleLogin}
        >
          Sign in with Google
        </button>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          Only pre-approved accounts can access this system.
        </p>
      </div>
    </div>
  );
}
