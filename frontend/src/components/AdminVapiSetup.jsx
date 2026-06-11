import React, { useState, useEffect } from 'react';
import './AdminVapiSetup.css';

export default function AdminVapiSetup() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState({ text: '', type: '' });
  const [configured, setConfigured] = useState(false);
  const [firstMessage, setFirstMessage] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [assistantName, setAssistantName] = useState('');

  const [vapiApiKey, setVapiApiKey] = useState('');
  const [vapiAssistantId, setVapiAssistantId] = useState('');
  const [activeMenuFile, setActiveMenuFile] = useState('');
  const [menuFiles, setMenuFiles] = useState([]);

  // Credit balance state
  const [creditInfo, setCreditInfo] = useState(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditDismissed, setCreditDismissed] = useState(false);

  useEffect(() => {
    fetchVapiSettings();
    fetchMenuFiles();
    fetchCreditBalance();
  }, []);

  const fetchVapiSettings = () => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/settings/vapi/prompt`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.configured) {
          setConfigured(true);
          setFirstMessage(data.firstMessage || '');
          setSystemPrompt(data.systemPrompt || '');
          setAssistantName(data.name || 'AI Assistant');
        } else {
          setConfigured(false);
        }
        setVapiApiKey(data.vapi_api_key || '');
        setVapiAssistantId(data.vapi_assistant_id || '');
        setActiveMenuFile(data.active_menu_file || 'menu.json');
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching VAPI settings:', err);
        setSaveMsg({ text: 'Error connecting to server to fetch VAPI settings.', type: 'error' });
        setLoading(false);
      });
  };

  const fetchMenuFiles = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/menu/files`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setMenuFiles(data);
      }
    } catch (err) {
      console.error('Error fetching menu files:', err);
    }
  };

  const fetchCreditBalance = async () => {
    setCreditLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/settings/vapi/credits`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setCreditInfo(data);
      }
    } catch (err) {
      console.error('Error fetching VAPI credit balance:', err);
    }
    setCreditLoading(false);
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setSaveMsg({ text: '', type: '' });
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/settings/vapi/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          vapi_api_key: vapiApiKey,
          vapi_assistant_id: vapiAssistantId,
          active_menu_file: activeMenuFile
        })
      });
      if (!res.ok) throw new Error('Failed to update config');
      setSaveMsg({ text: 'Config saved! Loading agent prompt...', type: 'success' });
      fetchVapiSettings(); // Fetch the new prompt for the updated agent
    } catch (err) {
      setSaveMsg({ text: err.message, type: 'error' });
      setSaving(false);
    }
  };

  const handleSavePrompt = async () => {
    setSaving(true);
    setSaveMsg({ text: '', type: '' });
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/settings/vapi/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          systemPrompt, 
          firstMessage
        })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update prompt on VAPI');
      }
      
      setSaveMsg({ text: 'Agent prompt successfully synchronized with VAPI!', type: 'success' });
    } catch (err) {
      setSaveMsg({ text: err.message, type: 'error' });
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="vapi-setup-loading">Connecting to VAPI...</div>;
  }

  // Determine credit warning status
  const showCreditWarning = creditInfo && creditInfo.configured && creditInfo.balance !== null && creditInfo.balance < 8 && !creditDismissed;

  return (
    <div className="vapi-setup-page">
      <h1>AI Agent Configuration</h1>
      <p className="vapi-setup-subtitle">
        Manage the system prompt and instructions for your VAPI voice agent. Changes here are synced instantly to VAPI.
      </p>

      {/* Low Credit Warning Banner */}
      {showCreditWarning && (
        <div className="vapi-credit-warning-banner">
          <div className="vapi-credit-warning-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div className="vapi-credit-warning-content">
            <strong>⚠️ VAPI Credit Balance Low!</strong>
            <p>Your VAPI account balance is <span className="vapi-credit-amount">${Number(creditInfo.balance).toFixed(2)}</span> — below the $8.00 minimum threshold. Your AI phone agent may stop working if credits run out. <a href="https://dashboard.vapi.ai" target="_blank" rel="noopener noreferrer">Add credits on the VAPI Dashboard →</a></p>
          </div>
          <button className="vapi-credit-dismiss" onClick={() => setCreditDismissed(true)} title="Dismiss">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      <div className="vapi-setup-grid">
        {/* Left: Settings Form */}
        <div className="vapi-setup-card main-editor">
          <div className="card-header-flex">
            <h2>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Agent System Prompt
            </h2>
            {configured && <span className="vapi-status-badge success">Connected: {assistantName}</span>}
            {!configured && <span className="vapi-status-badge error">Offline: Missing Env Variables</span>}
          </div>

          {!configured ? (
            <div className="vapi-alert warning">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div>
                <strong>VAPI is not configured.</strong>
                <p>Please provide the VAPI API Key and Assistant ID below.</p>
              </div>
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
            <div className="vapi-field">
              <label className="vapi-field-label">VAPI API Key</label>
              <input
                type="password"
                value={vapiApiKey}
                onChange={(e) => setVapiApiKey(e.target.value)}
                className="form-input"
                placeholder="sk-..."
              />
            </div>
            <div className="vapi-field">
              <label className="vapi-field-label">VAPI Assistant ID</label>
              <input
                type="text"
                value={vapiAssistantId}
                onChange={(e) => setVapiAssistantId(e.target.value)}
                className="form-input"
                placeholder="e.g. fd4b..."
              />
            </div>
            <div className="vapi-field" style={{ gridColumn: 'span 2' }}>
              <label className="vapi-field-label">Active Menu File</label>
              <select
                value={activeMenuFile}
                onChange={(e) => setActiveMenuFile(e.target.value)}
                className="form-input"
              >
                {menuFiles.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <button className="btn btn-outline" onClick={handleSaveConfig} disabled={saving} style={{ width: '100%' }}>
                {saving ? 'Updating Config...' : 'Apply Config Settings & Load Prompt'}
              </button>
            </div>
          </div>

          {configured && (
            <>
              <div className="vapi-field">
                <label className="vapi-field-label">First Message</label>
                <textarea
                  value={firstMessage}
                  onChange={(e) => setFirstMessage(e.target.value)}
                  className="vapi-prompt-textarea vapi-first-msg-textarea"
                  placeholder="e.g. Hello! Welcome to TTAKOUT. How can I help you today?"
                  spellCheck="false"
                />
              </div>

              <div className="vapi-field prompt-editor-container" style={{ marginTop: '1.5rem' }}>
                <label className="vapi-field-label">System Prompt</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="vapi-prompt-textarea"
                  placeholder="Enter the system instructions for your AI agent here..."
                  spellCheck="false"
                />
              </div>

              <div className="vapi-save-bar">
                <button className="btn btn-primary vapi-sync-btn" onClick={handleSavePrompt} disabled={saving}>
                  {saving ? 'Syncing to VAPI...' : 'Save & Sync to VAPI'}
                </button>
                {saveMsg.text && (
                  <span className={`vapi-save-msg ${saveMsg.type}`}>
                    {saveMsg.text}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: Info, Credits, and Tips */}
        <div className="vapi-setup-card tips-card">
          {/* Credit Balance Widget */}
          <div className="vapi-credit-widget">
            <h2>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              VAPI Credit Balance
            </h2>

            {creditLoading ? (
              <div className="vapi-credit-loading">Checking balance...</div>
            ) : creditInfo ? (
              <div className="vapi-credit-display">
                {creditInfo.error ? (
                  <div className="vapi-credit-error">
                    <p>{creditInfo.error}</p>
                  </div>
                ) : creditInfo.balance !== null ? (
                  <>
                    <div className={`vapi-credit-balance-card ${creditInfo.lowCredit ? 'low' : 'ok'}`}>
                      <span className="vapi-credit-label">Current Balance</span>
                      <span className="vapi-credit-value">${Number(creditInfo.balance).toFixed(2)}</span>
                      {creditInfo.lowCredit && (
                        <span className="vapi-credit-status low">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          Below $8 threshold
                        </span>
                      )}
                      {!creditInfo.lowCredit && (
                        <span className="vapi-credit-status ok">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                          Healthy
                        </span>
                      )}
                    </div>
                    {creditInfo.plan && (
                      <div className="vapi-credit-plan">Plan: {creditInfo.plan}</div>
                    )}
                  </>
                ) : (
                  <div className="vapi-credit-unavailable">
                    <p>Balance data unavailable via API.</p>
                    <a href="https://dashboard.vapi.ai" target="_blank" rel="noopener noreferrer" className="vapi-dashboard-link">
                      Check on VAPI Dashboard →
                    </a>
                  </div>
                )}
                <button className="btn btn-outline vapi-refresh-btn" onClick={fetchCreditBalance} disabled={creditLoading}>
                  {creditLoading ? 'Checking...' : '↻ Refresh Balance'}
                </button>
              </div>
            ) : (
              <div className="vapi-credit-unavailable">
                <p>Configure your VAPI API Key to check credit balance.</p>
              </div>
            )}
          </div>

          <hr className="vapi-section-divider" />

          <h2>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Prompting Best Practices
          </h2>
          
          <div className="vapi-tips-content">
            <div className="tip-item">
              <h4>Voice Over Text</h4>
              <p>Keep instructions concise. Long prompts increase latency and cause "dead air" before the agent responds.</p>
            </div>
            
            <div className="tip-item">
              <h4>Structured Format</h4>
              <p>Organize the prompt using headers like <code>[Identity]</code>, <code>[Style]</code>, and <code>[Task]</code> to help the LLM maintain focus.</p>
            </div>
            
            <div className="tip-item">
              <h4>Function Calling</h4>
              <p>If the agent has tools (like menu lookup or order submission), explicitly tell it <strong>when</strong> and <strong>how</strong> to use them in the task section.</p>
            </div>
            
            <div className="tip-item warning-tip">
              <h4>Wait for User</h4>
              <p>Voice AI tends to speak quickly. Include instructions like "Ask the user one question at a time and wait for their response."</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
