import React, { useState, useEffect } from 'react';
import './WebhookLogs.css'; // We will create this next

export default function WebhookLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/webhooks/vapi/logs`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch webhook logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  return (
    <div className="logs-page">
      <div className="logs-header">
        <div>
          <h1>Webhook Logs</h1>
          <p className="logs-subtitle">Monitor raw Vapi AI interactions</p>
        </div>
        <button className="btn btn-outline" onClick={fetchLogs}>
          Refresh Logs
        </button>
      </div>

      <div className="logs-container glass-panel">
        {loading ? (
          <div className="loading-state">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">No webhook logs found.</div>
        ) : (
          <div className="logs-list">
            {logs.map((log) => (
              <div key={log.id} className={`log-card ${expandedLogId === log.id ? 'expanded' : ''}`}>
                <div className="log-summary" onClick={() => toggleExpand(log.id)}>
                  <div className="log-summary-left">
                    <span className="log-time">{new Date(log.created_at).toLocaleString()}</span>
                    <span className="log-call-id">{log.call_id || 'Unknown Call'}</span>
                  </div>
                  <div className="log-summary-right">
                    <span className="expand-icon">{expandedLogId === log.id ? '▼' : '▶'}</span>
                  </div>
                </div>

                {expandedLogId === log.id && (
                  <div className="log-details">
                    <div className="payload-section">
                      <h4>Inbound Request (from Vapi)</h4>
                      <pre className="json-block">
                        {JSON.stringify(log.inbound_payload, null, 2)}
                      </pre>
                    </div>
                    <div className="payload-section">
                      <h4>Outbound Response (to Vapi)</h4>
                      <pre className="json-block">
                        {JSON.stringify(log.outbound_payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
