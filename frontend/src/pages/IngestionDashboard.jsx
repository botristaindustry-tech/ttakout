import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOrderStore } from '../store/orderStore';
import './IngestionDashboard.css';

const SLA_THRESHOLDS = {
  NORMAL: 5,
  WARNING: 10,
  URGENT: 15
};

const getSlaStatus = (elapsedMins) => {
  if (elapsedMins < SLA_THRESHOLDS.NORMAL) return { key: 'normal', label: 'WITHIN SLA' };
  if (elapsedMins < SLA_THRESHOLDS.WARNING) return { key: 'warning', label: 'WARNING' };
  if (elapsedMins < SLA_THRESHOLDS.URGENT) return { key: 'urgent', label: 'URGENT' };
  return { key: 'critical', label: 'CRITICAL' };
};

const formatElapsed = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

const formatPhone = (phone) => {
  if (!phone || phone === 'Unknown') return '—';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 10) {
    const match = cleaned.slice(-10).match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
    }
  }
  return phone;
};

export default function IngestionDashboard() {
  const { orders, updateOrderStatus } = useOrderStore();
  const [now, setNow] = useState(Date.now());
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [activeTab, setActiveTab] = useState('incoming');
  const [readOrders, setReadOrders] = useState(new Set());
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const audioCtxRef = useRef(null);
  const lastAlertTimeRef = useRef(0);

  const pendingOrders = orders.filter(o => o.status === 'PENDING');
  const flaggedOrders = orders.filter(o => o.status === 'FLAGGED');
  const pendingPaymentOrders = orders.filter(o => o.status === 'PENDING_PAYMENT');
  const archivedOrders = orders.filter(o => ['REJECTED', 'PAID'].includes(o.status));

  const playAlert = useCallback((volume, message) => {
    if (!isSoundEnabled) return;
    
    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.speaking) return; // Don't queue up overlapping announcements
      
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.volume = volume;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      window.speechSynthesis.speak(utterance);
    }
  }, [isSoundEnabled]);

  // Tick every second for live SLA timers and audio alerts
  useEffect(() => {
    const timer = setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);

      if (!isSoundEnabled || pendingOrders.length === 0) return;

      // Play alert every 10 seconds so the speech isn't overlapping/annoying
      if (currentTime - lastAlertTimeRef.current >= 10000) {
        const unreadOrders = pendingOrders.filter(o => !readOrders.has(o.id));
        
        let targetOrder = null;
        let message = "";
        
        if (unreadOrders.length > 0) {
          // Unread orders take priority
          targetOrder = unreadOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
          message = "You got a new order";
        } else {
          // If all are read but still pending, alert for unprocessed
          targetOrder = pendingOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
          message = "You have unprocessed order";
        }

        const waitTimeSeconds = (currentTime - new Date(targetOrder.created_at).getTime()) / 1000;
        
        let volume = 0.2; // Default 20%
        if (waitTimeSeconds > 60) {
          volume = 1.0; // 100% after 60s
        } else if (waitTimeSeconds > 30) {
          volume = 0.5; // 50% after 30s
        }
        
        playAlert(volume, message);
        lastAlertTimeRef.current = currentTime;
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingOrders, readOrders, isSoundEnabled, playAlert]);

  const handleToggleSound = () => {
    const nextState = !isSoundEnabled;
    setIsSoundEnabled(nextState);
    
    // Unlock iOS/Safari SpeechSynthesis by speaking immediately on user interaction
    if (nextState && 'speechSynthesis' in window) {
      const unlockUtterance = new SpeechSynthesisUtterance("");
      unlockUtterance.volume = 0;
      window.speechSynthesis.speak(unlockUtterance);
    }
  };

  const handleProcess = (id) => {
    updateOrderStatus(id, 'KITCHEN_QUEUED');
    setSelectedOrder(null);
  };

  const handleReject = () => {
    if (selectedOrder) {
      const reason = rejectReason === 'Other' ? customReason : rejectReason;
      updateOrderStatus(selectedOrder.id, 'REJECTED', reason);
      setSelectedOrder(null);
      setRejectMode(false);
      setRejectReason('');
      setCustomReason('');
    }
  };

  return (
    <div className="ingestion-page">
      <div className="ingestion-header">
        <div>
          <h1>Intake Control Center</h1>
          <p className="ingestion-subtitle">Front-of-house intake pipeline — {pendingOrders.length} pending</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            className={`tab-btn ${isSoundEnabled ? 'active' : ''}`}
            onClick={handleToggleSound}
            style={{ 
              borderColor: isSoundEnabled ? 'var(--status-normal)' : 'var(--border-subtle)',
              color: isSoundEnabled ? 'white' : 'var(--text-muted)'
            }}
          >
            {isSoundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF'}
          </button>
          
          <div className="tab-switcher">
            <button 
              className={`tab-btn ${activeTab === 'incoming' ? 'active' : ''}`}
              onClick={() => setActiveTab('incoming')}
            >
              <span className="tab-dot incoming-dot"></span>
              Incoming Queue
              {pendingOrders.length > 0 && <span className="tab-count">{pendingOrders.length}</span>}
            </button>
            <button 
              className={`tab-btn ${activeTab === 'awaiting-payment' ? 'active' : ''}`}
              onClick={() => setActiveTab('awaiting-payment')}
              style={{ borderColor: activeTab === 'awaiting-payment' ? '#f59e0b' : undefined }}
            >
              <span className="tab-dot" style={{ background: '#f59e0b' }}></span>
              Awaiting Payment
              {pendingPaymentOrders.length > 0 && <span className="tab-count" style={{ background: '#f59e0b' }}>{pendingPaymentOrders.length}</span>}
            </button>
            <button 
              className={`tab-btn ${activeTab === 'flagged' ? 'active' : ''}`}
              onClick={() => setActiveTab('flagged')}
            >
              <span className="tab-dot flagged-dot" style={{ background: '#f87171' }}></span>
              Flagged Orders
              {flaggedOrders.length > 0 && <span className="tab-count" style={{ background: 'var(--status-critical)' }}>{flaggedOrders.length}</span>}
            </button>
            <button 
              className={`tab-btn ${activeTab === 'archive' ? 'active' : ''}`}
              onClick={() => setActiveTab('archive')}
            >
              <span className="tab-dot archive-dot"></span>
              Archive Log
            </button>
          </div>
        </div>
      </div>

      {/* SLA Legend */}
      {activeTab === 'incoming' && (
        <div className="sla-legend">
          <div className="sla-legend-item"><span className="sla-dot normal"></span> 0–5 min: Normal</div>
          <div className="sla-legend-item"><span className="sla-dot warning"></span> 5–10 min: Warning</div>
          <div className="sla-legend-item"><span className="sla-dot urgent"></span> 10–15 min: Urgent</div>
          <div className="sla-legend-item"><span className="sla-dot critical"></span> 15+ min: Critical</div>
        </div>
      )}
      
      {activeTab === 'incoming' && (
        <div className="order-list">
          {pendingOrders.map(order => {
            const ingestTime = new Date(order.created_at).getTime();
            const elapsedSeconds = Math.floor((now - ingestTime) / 1000);
            const elapsedMins = Math.floor(elapsedSeconds / 60);
            const sla = getSlaStatus(elapsedMins);
            const isRead = readOrders.has(order.id);

            return (
              <div 
                key={order.id} 
                className={`order-list-row sla-${sla.key} ${isRead ? 'is-read' : ''}`}
                onClick={() => {
                  setSelectedOrder(order);
                  setReadOrders(prev => new Set(prev).add(order.id));
                }}
              >
                <div className={`row-indicator sla-indicator-${sla.key}`}></div>
                
                <div className="row-col-status">
                  <span className={`sla-badge sla-badge-${sla.key}`}>{sla.label}</span>
                </div>
                
                <div className="row-col-details">
                  <h3 className="order-code" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    #{order.daily_order_code || order.id.slice(0,8)}
                    {order.is_flagged && <span className="flagged-badge" style={{ fontSize: '0.7rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>⚠️ FLAGGED</span>}
                  </h3>
                  <p className="order-customer">{order.customer_name} • {order.restaurant_name}</p>
                </div>
                
                <div className="row-col-meta">
                  <span className="meta-items">{order.lines?.length || 0} items</span>
                  <span className="order-total">${Number(order.total || 0).toFixed(2)}</span>
                </div>
                
                <div className="row-col-time">
                  <span className="elapsed-timer">{formatElapsed(elapsedSeconds)}</span>
                  <span className="timestamp-small">
                    {new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
          {pendingOrders.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📥</div>
              <p>No incoming orders. Pipeline is clear.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'awaiting-payment' && (
        <div className="archive-table-wrapper glass-panel">
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(245, 158, 11, 0.2)', background: 'rgba(245, 158, 11, 0.05)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
            <p style={{ color: '#f59e0b', fontSize: '0.85rem', margin: 0 }}>⏳ These orders exceed the payment threshold. An SMS with a Stripe payment link was sent to the customer. They will appear in the Incoming Queue once payment is confirmed.</p>
          </div>
          <table className="archive-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Total</th>
                <th>Placed At</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pendingPaymentOrders.map(order => (
                <tr 
                  key={order.id} 
                  onClick={() => setSelectedOrder(order)} 
                  style={{ cursor: 'pointer' }}
                  title="Click to view details"
                >
                  <td style={{ color: '#f59e0b', fontWeight: 600 }}>#{order.daily_order_code || order.id.slice(0,8)}</td>
                  <td>{order.customer_name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{formatPhone(order.customer_phone)}</td>
                  <td style={{ fontWeight: 600, color: '#f59e0b' }}>${Number(order.total || 0).toFixed(2)}</td>
                  <td>
                    {new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-start' }}>
                      <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>💳 AWAITING PAYMENT</span>
                      {order.payment_url && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(order.payment_url);
                            e.target.innerText = '✅ Copied!';
                            setTimeout(() => e.target.innerText = '🔗 Copy Link', 2000);
                          }}
                          style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', padding: '0.15rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.7rem', cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                          🔗 Copy Link
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {pendingPaymentOrders.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No orders awaiting payment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'flagged' && (
        <div className="archive-table-wrapper glass-panel">
          <table className="archive-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Total</th>
                <th>Flagged At</th>
              </tr>
            </thead>
            <tbody>
              {flaggedOrders.map(order => (
                <tr 
                  key={order.id} 
                  onClick={() => setSelectedOrder(order)} 
                  style={{ cursor: 'pointer' }}
                  title="Click to view details"
                >
                  <td style={{ color: '#f87171', fontWeight: 600 }}>#{order.daily_order_code || order.id.slice(0,8)}</td>
                  <td>{order.customer_name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{order.customer_phone}</td>
                  <td style={{ fontWeight: 500 }}>${Number(order.total || 0).toFixed(2)}</td>
                  <td>
                    {new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
              {flaggedOrders.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No flagged orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'archive' && (
        <div className="archive-table-wrapper glass-panel">
          <table className="archive-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Resolution</th>
                <th>Settled At</th>
              </tr>
            </thead>
            <tbody>
              {archivedOrders.map(order => (
                <tr key={order.id}>
                  <td>#{order.daily_order_code || order.id.slice(0,8)}</td>
                  <td>{order.customer_name}</td>
                  <td>
                    <span className={`status-pill ${order.status === 'REJECTED' ? 'pill-rejected' : 'pill-paid'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="resolution-cell">{order.reject_reason || '—'}</td>
                  <td>{new Date(order.updated_at).toLocaleTimeString()}</td>
                </tr>
              ))}
              {archivedOrders.length === 0 && (
                <tr><td colSpan="5" className="empty-cell">No archived orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => { setSelectedOrder(null); setRejectMode(false); }}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Review Order <span className="text-gradient">#{selectedOrder.daily_order_code || selectedOrder.id.slice(0,8)}</span></h2>
              <button className="modal-close" onClick={() => { setSelectedOrder(null); setRejectMode(false); }}>✕</button>
            </div>

            <div className="modal-section">
              <div className="detail-row">
                <span className="detail-label">Customer</span>
                <span className="detail-value">{selectedOrder.customer_name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Phone</span>
                <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {formatPhone(selectedOrder.customer_phone)}
                  {selectedOrder.is_flagged && <span className="flagged-badge" style={{ fontSize: '0.75rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>⚠️ FLAGGED PHONE</span>}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Notes</span>
                <span className="detail-value">{selectedOrder.notes || 'None'}</span>
              </div>
            </div>

            <div className="modal-section">
              <h4 className="section-title">Line Items</h4>
              <div className="line-items-list">
                {selectedOrder.lines?.map(line => (
                  <div key={line.id} className="line-item">
                    <div className="line-item-main">
                      <span className="line-qty">{line.quantity}x</span>
                      <span className="line-name">{line.name}</span>
                      <span className="line-price">${Number(line.line_subtotal || 0).toFixed(2)}</span>
                    </div>
                    {line.modifiers?.length > 0 && (
                      <div className="line-modifiers">
                        {line.modifiers.map(mod => (
                          <span key={mod.id} className="modifier-tag">+ {mod.option_name || mod.name} {mod.price ? `($${Number(mod.price).toFixed(2)})` : ''}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-totals">
              <div className="total-row"><span>Subtotal</span><span>${Number(selectedOrder.subtotal || 0).toFixed(2)}</span></div>
              <div className="total-row"><span>Tax</span><span>${Number(selectedOrder.tax || 0).toFixed(2)}</span></div>
              <div className="total-row total-final"><span>Total</span><span>${Number(selectedOrder.total || 0).toFixed(2)}</span></div>
            </div>

            {selectedOrder.status === 'FLAGGED' ? (
              <div className="modal-actions">
                <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => setSelectedOrder(null)}>Close</button>
              </div>
            ) : rejectMode ? (
              <div className="reject-form">
                <h4 className="section-title">Rejection Classification</h4>
                <select 
                  className="reject-select"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                >
                  <option value="">— Select Failure Constraint —</option>
                  <option value="Fraudulent / Prank Interaction">Fraudulent / Prank Interaction</option>
                  <option value="Out-Of-Stock or Off-Menu">Out-Of-Stock or Off-Menu Item</option>
                  <option value="Invalid Phone">Invalid or Malformed Phone Identifier</option>
                  <option value="Other">Other (Freeform)</option>
                </select>
                {rejectReason === 'Other' && (
                  <textarea 
                    className="reject-textarea" 
                    placeholder="Describe the rejection reason..."
                    value={customReason}
                    onChange={e => setCustomReason(e.target.value)}
                  />
                )}
                <div className="modal-actions">
                  <button className="btn btn-danger" onClick={handleReject} disabled={!rejectReason || (rejectReason === 'Other' && !customReason)}>Confirm Reject</button>
                  <button className="btn btn-outline" onClick={() => setRejectMode(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={() => handleProcess(selectedOrder.id)}>Process → Send to KDS</button>
                <button className="btn btn-danger" onClick={() => setRejectMode(true)}>Reject Order</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
