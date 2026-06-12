import React, { useState, useEffect } from 'react';
import './AdminVapiBilling.css';

export default function AdminVapiBilling() {
  const [loading, setLoading] = useState(true);
  const [creditInfo, setCreditInfo] = useState(null);
  const [callData, setCallData] = useState({ calls: [], totalSpend: 0 });
  const [refillAmount, setRefillAmount] = useState('');
  const [isRefilling, setIsRefilling] = useState(false);
  const [refillMode, setRefillMode] = useState('add');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchCreditBalance(), fetchCallHistory()]);
    setLoading(false);
  };

  const fetchCreditBalance = async () => {
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
  };

  const fetchCallHistory = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/settings/vapi/calls`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setCallData(data);
      }
    } catch (err) {
      console.error('Error fetching VAPI calls:', err);
    }
  };

  const handleRefill = async (e) => {
    e.preventDefault();
    if (!refillAmount || isNaN(refillAmount)) return;
    
    setIsRefilling(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/settings/vapi/credits/refill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount: parseFloat(refillAmount), mode: refillMode })
      });
      if (res.ok) {
        setRefillAmount('');
        await fetchData();
      }
    } catch (err) {
      console.error('Error refilling budget:', err);
    }
    setIsRefilling(false);
  };

  if (loading && !creditInfo) {
    return <div className="vapi-billing-page"><div className="billing-loading">Loading Billing Data...</div></div>;
  }

  const showCreditWarning = creditInfo && creditInfo.lowCredit;

  return (
    <div className="vapi-billing-page">
      <h1>VAPI Billing & Logs</h1>
      <p className="vapi-billing-subtitle">
        Monitor your AI Agent call costs, track your internal budget, and view detailed call history.
      </p>

      {/* Warning Banner */}
      {showCreditWarning && (
        <div className="billing-warning-banner">
          <div className="billing-warning-icon">⚠️</div>
          <div className="billing-warning-content">
            <strong>Budget Running Low!</strong>
            <p>Your internal tracking budget has dropped below $8.00. Please review your actual VAPI account balance and top up the budget here.</p>
          </div>
        </div>
      )}

      <div className="billing-dashboard-grid">
        
        {/* Left Column: Top Metrics & Refill */}
        <div className="billing-col-left">
          <div className="billing-metrics-row">
            {/* Credit Balance Card */}
            <div className={`billing-card metric-card ${showCreditWarning ? 'danger' : 'success'}`}>
              <h3>Current Budget</h3>
              <div className="metric-value">
                ${Number(creditInfo?.balance || 0).toFixed(2)}
              </div>
              <div className="metric-sub">
                {showCreditWarning ? 'Below $8 Threshold' : 'Healthy Balance'}
              </div>
            </div>

            {/* Total Spend Card */}
            <div className="billing-card metric-card neutral">
              <h3>Total API Spend</h3>
              <div className="metric-value">
                ${Number(callData.totalSpend || 0).toFixed(2)}
              </div>
              <div className="metric-sub">Lifetime Cost Tracked</div>
            </div>
          </div>

          {/* Refill Form */}
          <div className="billing-card refill-card">
            <h3>Update Internal Budget</h3>
            <p className="refill-desc">
              Since VAPI does not allow us to pull your real balance via API, use this tool to synchronize the budget tracking.
            </p>
            <form onSubmit={handleRefill} className="refill-form">
              <div className="refill-inputs">
                <select 
                  value={refillMode} 
                  onChange={(e) => setRefillMode(e.target.value)}
                  className="refill-select"
                >
                  <option value="add">Add Funds (+)</option>
                  <option value="set">Set Exact Balance (=)</option>
                </select>
                <div className="amount-input-wrapper">
                  <span className="currency-symbol">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={refillAmount}
                    onChange={(e) => setRefillAmount(e.target.value)}
                    required
                    className="refill-amount"
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={isRefilling || !refillAmount}>
                {isRefilling ? 'Updating...' : 'Update Budget'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Call Logs */}
        <div className="billing-col-right">
          <div className="billing-card logs-card">
            <div className="logs-header">
              <h3>Recent Call Costs</h3>
              <button onClick={fetchCallHistory} className="btn btn-outline small">↻ Refresh</button>
            </div>
            
            <div className="logs-table-wrapper">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Call ID</th>
                    <th>Reason</th>
                    <th className="text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {callData.calls.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="empty-logs">No call history recorded yet.</td>
                    </tr>
                  ) : (
                    callData.calls.map(call => (
                      <tr key={call.call_id}>
                        <td className="log-date">
                          {new Date(call.created_at).toLocaleString([], {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="log-id" title={call.call_id}>
                          {call.call_id.substring(0, 8)}...
                        </td>
                        <td className="log-reason">
                          <span className={`reason-badge ${call.ended_reason}`}>
                            {call.ended_reason.replace('-', ' ')}
                          </span>
                        </td>
                        <td className="log-cost text-right">
                          ${Number(call.cost).toFixed(4)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
