import React, { useState, useEffect } from 'react';
import { useOrderStore } from '../store/orderStore';
import './KDS.css';

const getSlaStatus = (elapsedMins) => {
  if (elapsedMins < 5)  return 'normal';
  if (elapsedMins < 10) return 'warning';
  if (elapsedMins < 15) return 'urgent';
  return 'critical';
};

const formatDuration = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function KDS() {
  const { orders, updateOrderStatus, updateLineStatus } = useOrderStore();
  const [flippedCards, setFlippedCards] = useState({});
  const [now, setNow] = useState(Date.now());
  const [kdsStyles, setKdsStyles] = useState(null);

  // Tick every second for in-kitchen duration counter
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch KDS Styles
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/settings`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.kds_styles) {
          setKdsStyles(data.kds_styles);
        }
      })
      .catch(err => console.error('Error fetching settings:', err));
  }, []);

  const queuedOrders = orders.filter(o => o.status === 'KITCHEN_QUEUED');
  const readyCount = orders.filter(o => o.status === 'READY_FOR_PICKUP').length;
  const paidCount = orders.filter(o => o.status === 'PAID').length;
  const todayTotal = orders.length;

  const handleFlip = (id) => {
    setFlippedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCheckbox = (lineId, currentStatus) => {
    updateLineStatus(lineId, !currentStatus);
  };

  const allLinesCompleted = (order) => {
    return order.lines && order.lines.length > 0 && order.lines.every(l => l.is_completed);
  };

  const customStyles = kdsStyles ? {
    '--kds-item-size': kdsStyles.itemFontSize,
    '--kds-mod-size': kdsStyles.modFontSize,
    '--kds-text-color': kdsStyles.textColor,
    '--kds-mod-color': kdsStyles.modColor
  } : {};

  return (
    <div className="kds-page" style={customStyles}>
      {/* Header Metrics */}
      <div className="kds-header">
        <h1>Kitchen Display</h1>
        <div className="kds-metrics">
          <div className="metric">
            <span className="metric-value">{todayTotal}</span>
            <span className="metric-label">Total Today</span>
          </div>
          <div className="metric">
            <span className="metric-value highlight-queue">{queuedOrders.length}</span>
            <span className="metric-label">In Queue</span>
          </div>
          <div className="metric">
            <span className="metric-value highlight-ready">{readyCount + paidCount}</span>
            <span className="metric-label">Processed</span>
          </div>
        </div>
      </div>

      {/* 2-Row Spatial Grid with horizontal scroll */}
      <div className="kds-grid">
        {queuedOrders.map(order => {
          const isFlipped = flippedCards[order.id];
          const ingestTime = new Date(order.updated_at || order.created_at).getTime();
          const ingestDate = new Date(order.updated_at || order.created_at);
          const formattedTimestamp = ingestDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + ingestDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          const elapsedSeconds = Math.floor((now - ingestTime) / 1000);
          const elapsedMins = Math.floor(elapsedSeconds / 60);
          const slaKey = getSlaStatus(elapsedMins);
          const canComplete = allLinesCompleted(order);

          return (
            <div key={order.id} className={`kds-card ${isFlipped ? 'is-flipped' : ''}`}>
              <div className="kds-card-inner">
                {/* FRONT */}
                <div className={`kds-card-front sla-bg-${slaKey}`} onClick={() => handleFlip(order.id)}>
                  <div className="kds-front-code">#{order.daily_order_code || order.id.slice(0,4)}</div>
                  <div className="kds-front-timestamp" style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '-5px', marginBottom: '10px' }}>{formattedTimestamp}</div>
                  <div className="kds-front-timer">{formatDuration(elapsedSeconds)}</div>
                  <div className="kds-front-items">{order.lines?.length || 0} items</div>
                  <div className="kds-front-hint">tap to view</div>
                </div>

                {/* BACK */}
                <div className="kds-card-back">
                  <div className="kds-back-header">
                    <div>
                      <h3 style={{ margin: 0 }}>#{order.daily_order_code || order.id.slice(0,4)}</h3>
                      <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '2px' }}>{formattedTimestamp}</div>
                    </div>
                    <button className="kds-flip-btn" onClick={(e) => { e.stopPropagation(); handleFlip(order.id); }}>↩</button>
                  </div>
                  
                  <div className="kds-back-items">
                    {order.lines?.map(line => (
                      <label key={line.id} className={`kds-line ${line.is_completed ? 'struck' : ''}`} onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={line.is_completed || false}
                          onChange={() => handleCheckbox(line.id, line.is_completed)}
                        />
                        <span className="kds-line-text">
                          <strong>{line.quantity}x</strong> {line.name}
                          {line.modifiers?.map(m => (
                            <span key={m.id} className="kds-mod">+ {m.option_name || m.name}</span>
                          ))}
                        </span>
                      </label>
                    ))}
                  </div>

                  {canComplete && (
                    <div className="kds-success-msg">
                      ✓ All items processed
                    </div>
                  )}
                  <button 
                    className={`btn kds-complete-btn ${canComplete ? 'btn-primary' : ''}`}
                    onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, 'READY_FOR_PICKUP'); }}
                    disabled={!canComplete}
                  >
                    {canComplete ? 'Send to front for pickup' : 'Check all items first'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {queuedOrders.length === 0 && (
          <div className="kds-empty">
            <div className="empty-icon">🍳</div>
            <p>Kitchen queue is clear. No active orders.</p>
          </div>
        )}
      </div>
    </div>
  );
}
