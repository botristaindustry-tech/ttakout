import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const [dateRange, setDateRange] = useState('Today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [data, setData] = useState({
    timeSeries: [],
    isMultiDay: false,
    paymentSplit: [],
    rejected: 0,
    totals: { count: 0, revenue: 0 }
  });
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    const todayDate = new Date();
    const formatDate = (d) => {
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };
    
    let start = todayDate;
    let end = todayDate;

    if (dateRange === 'Last 7 Days') {
      start = new Date(todayDate);
      start.setDate(todayDate.getDate() - 7);
    } else if (dateRange === 'Last 14 Days') {
      start = new Date(todayDate);
      start.setDate(todayDate.getDate() - 14);
    } else if (dateRange === 'This Month') {
      start = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    } else if (dateRange === 'Last Month') {
      start = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
      end = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0);
    } else if (dateRange === '3 Months Ago') {
      start = new Date(todayDate.getFullYear(), todayDate.getMonth() - 3, 1);
      end = new Date(todayDate.getFullYear(), todayDate.getMonth() - 2, 0);
    }

    let queryParams = `?startDate=${formatDate(start)}&endDate=${formatDate(end)}`;
    if (dateRange === 'Custom') {
      if (!customStart || !customEnd) {
        setLoading(false);
        return; // Don't fetch if custom dates aren't set yet
      }
      queryParams = `?startDate=${customStart}&endDate=${customEnd}`;
    }

    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/orders/analytics/today${queryParams}`)
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch analytics:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, customStart, customEnd]);

  if (loading) {
    return <div className="admin-dashboard-page">Loading Analytics...</div>;
  }

  if (data.error) {
    return (
      <div className="admin-dashboard-page">
        <div className="admin-dashboard-header">
          <h1>Activity Dashboard</h1>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ color: 'var(--error)' }}>Failed to load data</h2>
          <p>{data.error}</p>
        </div>
      </div>
    );
  }

  // Format time series data for the chart
  const formatLabel = (label, isMultiDay) => {
    if (isMultiDay) {
      // It's a date string like "2026-05-26T00:00:00.000Z", but sometimes it's just "2026-05-26"
      // Append T12:00:00Z to ensure it doesn't shift back a day due to local timezone offsets
      const dateStr = label.includes('T') ? label : `${label}T12:00:00Z`;
      return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else {
      // It's an hour number
      const hour = parseInt(label);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const h = hour % 12 || 12;
      return `${h} ${ampm}`;
    }
  };

  const chartData = (data.timeSeries || []).map(d => ({
    label: formatLabel(d.label, data.isMultiDay),
    orders: parseInt(d.count),
    revenue: parseFloat(d.revenue)
  }));

  const rejectedChartData = (data.rejectedTimeSeries || []).map(d => ({
    label: formatLabel(d.label, data.isMultiDay),
    count: parseInt(d.count)
  }));

  const pieData = data.paymentSplit.map(d => ({
    name: d.payment_type,
    value: parseInt(d.count),
    revenue: parseFloat(d.revenue)
  }));

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899'];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="custom-tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={`item-${index}`} className="custom-tooltip-item" style={{ color: entry.color }}>
              {entry.name === 'revenue' || entry.name === 'Revenue' 
                ? 'Revenue:' 
                : (entry.name.includes('Rejected') ? 'Rejected:' : 'Orders:')} 
              <span>
                {entry.name === 'revenue' || entry.name === 'Revenue' 
                  ? `$${entry.value.toFixed(2)}` 
                  : entry.value}
              </span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="admin-dashboard-page">
      <div className="admin-dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Activity Dashboard</h1>
          <p>Performance and analytics overview.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {dateRange === 'Custom' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input 
                type="date" 
                className="date-input" 
                value={customStart} 
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
              />
              <span style={{ color: 'var(--text-muted)' }}>to</span>
              <input 
                type="date" 
                className="date-input" 
                value={customEnd} 
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
              />
            </div>
          )}
          <select 
            className="date-range-select" 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            <option value="Today">Today</option>
            <option value="Last 7 Days">Last 7 Days</option>
            <option value="Last 14 Days">Last 14 Days</option>
            <option value="This Month">This Month</option>
            <option value="Last Month">Last Month</option>
            <option value="3 Months Ago">3 Months Ago</option>
            <option value="Custom">Custom Date Range</option>
          </select>
        </div>
      </div>

      <div className="dashboard-stats-grid">
        <div className="stat-card revenue glass-panel">
          <span className="stat-card-title">Today's Revenue</span>
          <span className="stat-card-value">${Number(data.totals.revenue || 0).toFixed(2)}</span>
          <span className="stat-card-subtitle">Excludes rejected orders</span>
        </div>
        <div className="stat-card orders glass-panel">
          <span className="stat-card-title">Completed Orders</span>
          <span className="stat-card-value">{data.totals.count || 0}</span>
          <span className="stat-card-subtitle">Successfully processed today</span>
        </div>
        <div className="stat-card rejected glass-panel">
          <span className="stat-card-title">Rejected Orders</span>
          <span className="stat-card-value">{data.rejected || 0}</span>
          <span className="stat-card-subtitle">Failed or fraudulent orders</span>
        </div>
      </div>

      <div className="dashboard-charts-grid">
        {/* Hourly Volume Chart */}
        <div className="chart-card glass-panel">
          <h3>Hourly Order Volume</h3>
          <div className="chart-wrapper">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="label" stroke="#94a3b8" tick={{fill: '#94a3b8'}} tickMargin={10} />
                  <YAxis yAxisId="left" stroke="#94a3b8" tick={{fill: '#94a3b8'}} tickMargin={10} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{fill: '#10b981'}} tickMargin={10} />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                  <Bar yAxisId="left" dataKey="orders" name="Orders" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                No data available for this date range yet.
              </div>
            )}
          </div>
        </div>

        {/* Hourly Rejected/Flagged Orders Chart */}
        <div className="chart-card glass-panel">
          <h3>Hourly Rejected Orders</h3>
          <div className="chart-wrapper">
            {rejectedChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rejectedChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="label" stroke="#94a3b8" tick={{fill: '#94a3b8'}} tickMargin={10} />
                  <YAxis stroke="#94a3b8" tick={{fill: '#94a3b8'}} tickMargin={10} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                  <Bar dataKey="count" name="Rejected Orders" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                No rejected orders available for this date range yet.
              </div>
            )}
          </div>
        </div>

        {/* Payment Type Split Chart */}
        <div className="chart-card glass-panel">
          <h3>Payment Breakdown</h3>
          <div className="chart-wrapper">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: 'var(--text-primary)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                No payments recorded for this date range yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
