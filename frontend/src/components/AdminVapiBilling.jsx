import React, { useState, useEffect, useCallback } from 'react';
import './AdminVapiBilling.css';

const API = () => import.meta.env.VITE_API_URL || 'http://localhost:5005';

// Pure CSS bar chart component
function BarChart({ data, valueKey, labelKey, color, formatValue }) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No data for this period</div>;
  }
  const max = Math.max(...data.map(d => d[valueKey]), 0.0001);
  return (
    <div className="bar-chart">
      {data.map((d, i) => {
        const pct = (d[valueKey] / max) * 100;
        const label = labelKey ? d[labelKey] : '';
        const val = formatValue ? formatValue(d[valueKey]) : d[valueKey];
        return (
          <div className="bar-col" key={i}>
            <div className="bar-tooltip">{val}</div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ height: `${pct}%`, background: color }}
              />
            </div>
            <div className="bar-label">{label}</div>
          </div>
        );
      })}
    </div>
  );
}

function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function AdminVapiBilling() {
  const today = toDateStr(new Date());

  const [selectedDate, setSelectedDate] = useState(today);
  const [creditInfo, setCreditInfo] = useState(null);
  const [dayData, setDayData] = useState({ calls: [], daySpend: 0, dayCallCount: 0, totalSpend: 0 });
  const [dailyStats, setDailyStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);

  const [refillAmount, setRefillAmount] = useState('');
  const [isRefilling, setIsRefilling] = useState(false);
  const [refillMode, setRefillMode] = useState('add');
  const [refillSuccess, setRefillSuccess] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const fetchCreditBalance = useCallback(async () => {
    try {
      const res = await fetch(`${API()}/api/v1/settings/vapi/credits`, { credentials: 'include' });
      if (res.ok) setCreditInfo(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchDayData = useCallback(async (date) => {
    try {
      const res = await fetch(`${API()}/api/v1/settings/vapi/calls?date=${date}`, { credentials: 'include' });
      if (res.ok) setDayData(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchDailyStats = useCallback(async () => {
    setChartsLoading(true);
    try {
      const res = await fetch(`${API()}/api/v1/settings/vapi/calls/daily`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDailyStats(data.daily || []);
      }
    } catch (e) { console.error(e); }
    setChartsLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchCreditBalance(), fetchDayData(selectedDate), fetchDailyStats()]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    fetchDayData(selectedDate);
  }, [selectedDate]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`${API()}/api/v1/settings/vapi/calls/sync`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setSyncResult({ ok: true, ...data });
        // Refresh everything after sync
        await Promise.all([fetchCreditBalance(), fetchDayData(selectedDate), fetchDailyStats()]);
      } else {
        setSyncResult({ ok: false, error: data.error || 'Sync failed' });
      }
    } catch (e) {
      setSyncResult({ ok: false, error: 'Network error — is the server running?' });
    }
    setSyncing(false);
    setTimeout(() => setSyncResult(null), 8000);
  };

  const shiftDate = (days) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    const next = toDateStr(d);
    if (next <= today) setSelectedDate(next);
  };

  const handleRefill = async (e) => {
    e.preventDefault();
    if (!refillAmount || isNaN(refillAmount)) return;
    setIsRefilling(true);
    try {
      const res = await fetch(`${API()}/api/v1/settings/vapi/credits/refill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount: parseFloat(refillAmount), mode: refillMode })
      });
      if (res.ok) {
        setRefillAmount('');
        setRefillSuccess(true);
        setTimeout(() => setRefillSuccess(false), 3000);
        await fetchCreditBalance();
      }
    } catch (e) { console.error(e); }
    setIsRefilling(false);
  };

  const isToday = selectedDate === today;
  const showWarning = creditInfo?.lowCredit;

  // Build a label-friendly version of the 30-day chart data
  const callsChartData = dailyStats.map(d => ({
    day: formatShortDate(d.day),
    call_count: d.call_count
  }));
  const costChartData = dailyStats.map(d => ({
    day: formatShortDate(d.day),
    total_cost: d.total_cost
  }));

  if (loading) {
    return (
      <div className="vapi-billing-page">
        <div className="billing-loading">
          <div className="billing-spinner" />
          Loading Billing Data...
        </div>
      </div>
    );
  }

  return (
    <div className="vapi-billing-page">

      {/* Header */}
      <div className="billing-page-header">
        <div>
          <h1>VAPI Billing & Logs</h1>
          <p className="vapi-billing-subtitle">Track AI call costs, monitor your budget, and browse daily call history.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className={`btn btn-sync ${syncing ? 'syncing' : ''}`}
            onClick={handleSync}
            disabled={syncing}
            title="Pull latest call history from VAPI and import any missing calls"
          >
            <span className={`sync-icon ${syncing ? 'spinning' : ''}`}>⟳</span>
            {syncing ? 'Syncing from VAPI...' : 'Sync from VAPI'}
          </button>
          <button className="btn btn-outline" onClick={() => {
            fetchDailyStats();
            fetchDayData(selectedDate);
            fetchCreditBalance();
          }}>↻ Refresh All</button>
        </div>
      </div>

      {/* Sync Result Banner */}
      {syncResult && (
        <div className={`sync-result-banner ${syncResult.ok ? 'ok' : 'err'}`}>
          {syncResult.ok
            ? `✓ Sync complete — ${syncResult.imported} new call${syncResult.imported !== 1 ? 's' : ''} imported, ${syncResult.skipped} already tracked. New cost deducted: $${syncResult.totalNewCost.toFixed(4)}`
            : `✗ Sync failed: ${syncResult.error}`
          }
        </div>
      )}

      {/* Warning Banner */}
      {showWarning && (
        <div className="billing-warning-banner">
          <span className="warning-emoji">⚠️</span>
          <div>
            <strong>Budget Running Low — ${Number(creditInfo.balance).toFixed(2)} remaining</strong>
            <p>Your tracked budget is below the $8.00 threshold. Update your balance below after topping up your VAPI account.</p>
          </div>
        </div>
      )}

      {/* Top Metrics Row */}
      <div className="billing-metrics-strip">
        <div className={`metric-tile ${showWarning ? 'danger' : 'success'}`}>
          <span className="metric-tile-label">Internal Budget</span>
          <span className="metric-tile-value">${Number(creditInfo?.balance || 0).toFixed(2)}</span>
          <span className="metric-tile-sub">{showWarning ? '⚠ Below $8 threshold' : '✓ Healthy'}</span>
        </div>
        <div className="metric-tile neutral">
          <span className="metric-tile-label">Lifetime Spend</span>
          <span className="metric-tile-value">${Number(dayData.totalSpend || 0).toFixed(2)}</span>
          <span className="metric-tile-sub">All time tracked</span>
        </div>
        <div className="metric-tile accent">
          <span className="metric-tile-label">Today's Calls</span>
          <span className="metric-tile-value">{dayData.dayCallCount}</span>
          <span className="metric-tile-sub">{isToday ? 'So far today' : 'On selected date'}</span>
        </div>
        <div className="metric-tile accent2">
          <span className="metric-tile-label">Today's Cost</span>
          <span className="metric-tile-value">${Number(dayData.daySpend || 0).toFixed(4)}</span>
          <span className="metric-tile-sub">{isToday ? 'So far today' : 'On selected date'}</span>
        </div>
      </div>

      {/* Charts Section */}
      <div className="billing-charts-section">
        <div className="billing-card chart-card">
          <h3>Calls per Day <span className="chart-range-label">Last 30 Days</span></h3>
          {chartsLoading
            ? <div className="chart-loading">Loading chart...</div>
            : <BarChart
                data={callsChartData}
                valueKey="call_count"
                labelKey="day"
                color="linear-gradient(to top, #6366f1, #a5b4fc)"
                formatValue={v => `${v} calls`}
              />
          }
        </div>
        <div className="billing-card chart-card">
          <h3>Cost per Day <span className="chart-range-label">Last 30 Days</span></h3>
          {chartsLoading
            ? <div className="chart-loading">Loading chart...</div>
            : <BarChart
                data={costChartData}
                valueKey="total_cost"
                labelKey="day"
                color="linear-gradient(to top, #f59e0b, #fcd34d)"
                formatValue={v => `$${Number(v).toFixed(3)}`}
              />
          }
        </div>
      </div>

      {/* Date Call Log + Refill Side by Side */}
      <div className="billing-lower-grid">

        {/* Call Log with date navigator */}
        <div className="billing-card logs-card">
          <div className="logs-date-nav">
            <button className="nav-btn" onClick={() => shiftDate(-1)}>‹</button>
            <div className="logs-date-display">
              <input
                type="date"
                value={selectedDate}
                max={today}
                onChange={e => setSelectedDate(e.target.value)}
                className="date-picker-input"
              />
              <span className="date-label">
                {selectedDate === today ? 'Today' : formatShortDate(selectedDate)}
              </span>
            </div>
            <button
              className="nav-btn"
              onClick={() => shiftDate(1)}
              disabled={isToday}
              style={{ opacity: isToday ? 0.3 : 1 }}
            >›</button>
          </div>

          <div className="day-summary-row">
            <span>{dayData.dayCallCount} call{dayData.dayCallCount !== 1 ? 's' : ''}</span>
            <span className="day-cost-summary">${Number(dayData.daySpend).toFixed(4)} spent</span>
          </div>

          <div className="logs-table-wrapper">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Call ID</th>
                  <th>Reason</th>
                  <th className="text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {dayData.calls.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-logs">
                      No calls recorded on {formatShortDate(selectedDate)}.
                    </td>
                  </tr>
                ) : (
                  dayData.calls.map(call => (
                    <tr key={call.call_id}>
                      <td className="log-date">
                        {new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="log-id" title={call.call_id}>
                        {call.call_id.length > 12 ? call.call_id.substring(0, 12) + '…' : call.call_id}
                      </td>
                      <td>
                        <span className={`reason-badge ${call.ended_reason?.replace(/[^a-z-]/gi, '') || ''}`}>
                          {(call.ended_reason || 'unknown').replace(/-/g, ' ')}
                        </span>
                      </td>
                      <td className="log-cost text-right">${Number(call.cost).toFixed(4)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Refill / Budget Control */}
        <div className="billing-card refill-card">
          <h3>Update Internal Budget</h3>
          <p className="refill-desc">
            Since VAPI doesn't expose live balances via API, use this tool to sync your tracked balance whenever you top up your VAPI account.
          </p>
          <form onSubmit={handleRefill} className="refill-form">
            <div className="refill-mode-tabs">
              <button
                type="button"
                className={`mode-tab ${refillMode === 'add' ? 'active' : ''}`}
                onClick={() => setRefillMode('add')}
              >+ Add Funds</button>
              <button
                type="button"
                className={`mode-tab ${refillMode === 'set' ? 'active' : ''}`}
                onClick={() => setRefillMode('set')}
              >= Set Balance</button>
            </div>
            <div className="amount-input-wrapper">
              <span className="currency-symbol">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={refillAmount}
                onChange={e => setRefillAmount(e.target.value)}
                required
                className="refill-amount"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={isRefilling || !refillAmount}>
              {isRefilling ? 'Updating...' : refillMode === 'add' ? '+ Add to Budget' : 'Set Budget'}
            </button>
            {refillSuccess && <p className="refill-success">✓ Budget updated successfully!</p>}
          </form>

          {/* Current budget summary */}
          <div className={`budget-summary ${showWarning ? 'low' : 'ok'}`}>
            <span className="budget-summary-label">Current Tracked Balance</span>
            <span className="budget-summary-value">${Number(creditInfo?.balance || 0).toFixed(2)}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
