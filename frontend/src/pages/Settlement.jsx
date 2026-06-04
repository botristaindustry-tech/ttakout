import React, { useState } from 'react';
import { useOrderStore } from '../store/orderStore';
import './Settlement.css';

const maskPhone = (phone) => {
  if (!phone || phone === 'Unknown') return '—';
  // Mask middle digits: +15165551234 → +1 516-***-1234
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 10) {
    const last4 = cleaned.slice(-4);
    const area = cleaned.slice(-10, -7);
    return `+1 ${area}-***-${last4}`;
  }
  return phone;
};

export default function Settlement() {
  const { orders, updateOrderStatus } = useOrderStore();
  const [activeSubTab, setActiveSubTab] = useState('ready');
  const [flippedCards, setFlippedCards] = useState({});
  const [selectedTender, setSelectedTender] = useState({});
  const [successMsg, setSuccessMsg] = useState({});
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('card');
  
  const readyOrders = orders.filter(o => o.status === 'READY_FOR_PICKUP');
  const paidOrders = orders.filter(o => o.status === 'PAID');

  const handleFlip = (id) => {
    setFlippedCards(prev => ({ ...prev, [id]: !prev[id] }));
    // Reset state if they flip it back and forth
    setSelectedTender(prev => { const copy = {...prev}; delete copy[id]; return copy; });
    setSuccessMsg(prev => { const copy = {...prev}; delete copy[id]; return copy; });
  };

  const handleTenderSelect = (id, method) => {
    setSelectedTender(prev => ({ ...prev, [id]: method }));
  };

  const handleConfirmPay = (id) => {
    updateOrderStatus(id, 'PAID', null, selectedTender[id] || 'Unknown');
    setSuccessMsg(prev => ({ ...prev, [id]: true }));
    // Hide the success message after 2s and the order will naturally flow to "Paid" tab via state
    setTimeout(() => {
      setSuccessMsg(prev => {
        const next = {...prev};
        delete next[id];
        return next;
      });
      setSelectedTender(prev => {
        const next = {...prev};
        delete next[id];
        return next;
      });
      setFlippedCards(prev => { const copy = {...prev}; delete copy[id]; return copy; });
    }, 2000);
  };

  const rawOrders = activeSubTab === 'ready' ? readyOrders : paidOrders;
  const displayOrders = rawOrders.filter(order => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const code = (order.daily_order_code || order.id.slice(0,4)).toString().toLowerCase();
    const name = (order.customer_name || '').toLowerCase();
    const phone = (order.customer_phone || '').toLowerCase();
    return code.includes(q) || name.includes(q) || phone.includes(q);
  });

  return (
    <div className="settlement-page">
      <div className="settlement-header">
        <div>
          <h1>Pickup & Settlement</h1>
          <p className="settlement-subtitle">Process customer payments for completed orders</p>
        </div>

        <div className="settlement-controls" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Search name or phone..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="settlement-search"
          />
          
          <div className="view-toggle">
            <button className={`toggle-btn ${viewMode === 'card' ? 'active' : ''}`} onClick={() => setViewMode('card')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            </button>
            <button className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </button>
          </div>

          <div className="settlement-tabs">
            <button className={`tab-btn ${activeSubTab === 'ready' ? 'active' : ''}`} onClick={() => setActiveSubTab('ready')}>
              Ready for Pickup
              {readyOrders.length > 0 && <span className="tab-count">{readyOrders.length}</span>}
            </button>
            <button className={`tab-btn ${activeSubTab === 'paid' ? 'active' : ''}`} onClick={() => setActiveSubTab('paid')}>
              Paid Orders
              {paidOrders.length > 0 && <span className="tab-count">{paidOrders.length}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Payment Method Sticky Bar */}
      {activeSubTab === 'ready' && readyOrders.length > 0 && (
        <div className="payment-bar glass-panel">
          <span className="payment-bar-label">Settlement Method:</span>
          <div className="payment-options">
            <span className="payment-chip credit">💳 Credit Card</span>
            <span className="payment-chip cash">💵 Cash</span>
          </div>
          <span className="payment-bar-hint">Select a method per order card below</span>
        </div>
      )}

      {viewMode === 'list' ? (
        <div className="paid-orders-list glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          <table className="admin-table" style={{ width: '100%', minWidth: '700px' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ textAlign: 'left' }}>Order Code</th>
                <th style={{ textAlign: 'left' }}>Name</th>
                <th style={{ textAlign: 'left' }}>Phone</th>
                <th style={{ textAlign: 'left' }}>Amount</th>
                <th style={{ textAlign: 'left' }}>Time Updated</th>
                <th style={{ textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayOrders.map(order => {
                const isPaid = order.status === 'PAID';
                return (
                  <tr 
                    key={order.id} 
                    className="paid-order-row"
                    onDoubleClick={() => setSelectedOrder(order)}
                    title="Double click to view details"
                  >
                    <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                      #{order.daily_order_code || order.id.slice(0,4)}
                      {order.is_flagged && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '0.05rem 0.3rem', borderRadius: '0.25rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>⚠️ FLAGGED</span>}
                    </td>
                    <td>{order.customer_name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{maskPhone(order.customer_phone)}</td>
                    <td style={{ fontWeight: 500 }}>${Number(order.total || 0).toFixed(2)}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {new Date(order.updated_at || order.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="status-pill pill-ready" style={{ display: 'inline-block', background: isPaid ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)', color: isPaid ? 'var(--status-normal)' : 'var(--accent-primary)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
                        {isPaid ? `✓ ${order.payment_type || 'Paid'}` : 'READY'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {displayOrders.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="settlement-grid">
          {displayOrders.map(order => {
            const isFlipped = flippedCards[order.id];
            const isPaid = order.status === 'PAID';

            return (
              <div key={order.id} className={`settlement-card ${isFlipped ? 'is-flipped' : ''} ${isPaid ? 'is-paid' : ''}`}>
                <div className="settlement-card-inner">
                  {/* Front */}
                  <div className="settlement-card-front glass-panel" onClick={() => !isPaid && handleFlip(order.id)}>
                    <div className="settlement-front-status">
                      <span className={`status-pill ${isPaid ? 'pill-paid' : 'pill-ready'}`}>
                        {isPaid ? '✓ PAID' : 'READY'}
                      </span>
                    </div>
                     <h2 className="settlement-order-code" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                       #{order.daily_order_code || order.id.slice(0,4)}
                       {order.is_flagged && <span style={{ fontSize: '0.7rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '0.05rem 0.3rem', borderRadius: '0.25rem', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 500 }}>⚠️ FLAGGED</span>}
                     </h2>
                    <div className="settlement-customer">
                      <p className="customer-name">{order.customer_name}</p>
                      <p className="customer-phone">{maskPhone(order.customer_phone)}</p>
                    </div>
                    <div className="settlement-total-preview">
                      <span>Total Due</span>
                      <span className="total-amount">${Number(order.total || 0).toFixed(2)}</span>
                    </div>
                    {!isPaid && <div className="settlement-front-hint">tap to settle</div>}
                  </div>

                  {/* Back */}
                  <div className="settlement-card-back glass-panel">
                    <div className="settlement-back-header">
                      <h3>#{order.daily_order_code || order.id.slice(0,4)}</h3>
                      <button className="kds-flip-btn" onClick={(e) => { e.stopPropagation(); handleFlip(order.id); }}>↩</button>
                    </div>

                    <div className="settlement-back-customer">
                      <div className="scustomer-row">
                        <span className="label">Customer</span>
                        <span className="value">{order.customer_name}</span>
                      </div>
                       <div className="scustomer-row">
                         <span className="label">Phone</span>
                         <span className="value" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                           {maskPhone(order.customer_phone)}
                           {order.is_flagged && <span style={{ fontSize: '0.65rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '0.05rem 0.2rem', borderRadius: '0.15rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>⚠️ FLAGGED</span>}
                         </span>
                       </div>
                      <div className="scustomer-row">
                        <span className="label">Notes</span>
                        <span className="value">{order.notes || 'None'}</span>
                      </div>
                    </div>

                    <div className="settlement-items">
                      {order.lines?.map(line => (
                        <div key={line.id} className="settlement-line">
                          <span>{line.quantity}x {line.name}</span>
                          <span className="line-price">${Number(line.line_subtotal || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="settlement-totals">
                      <div className="stotal-row"><span>Subtotal</span><span>${Number(order.subtotal || 0).toFixed(2)}</span></div>
                      <div className="stotal-row"><span>Tax</span><span>${Number(order.tax || 0).toFixed(2)}</span></div>
                      <div className="stotal-row stotal-final"><span>Total</span><span>${Number(order.total || 0).toFixed(2)}</span></div>
                    </div>

                    <div className="settlement-pay-actions" onClick={e => e.stopPropagation()}>
                      {successMsg[order.id] ? (
                        <div className="settlement-success-msg">
                          Order now saved to "Paid Orders"
                        </div>
                      ) : selectedTender[order.id] ? (
                        <button className="btn btn-primary settle-btn" onClick={() => handleConfirmPay(order.id)}>
                          Paid via {selectedTender[order.id]}
                        </button>
                      ) : (
                        <>
                          <button className="btn btn-outline settle-btn credit-btn" onClick={() => handleTenderSelect(order.id, 'Credit Card')}>
                            💳 Credit Card
                          </button>
                          <button className="btn btn-outline settle-btn cash-btn" onClick={() => handleTenderSelect(order.id, 'Cash')}>
                            💵 Cash
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {displayOrders.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">{activeSubTab === 'ready' ? '🛎️' : '✅'}</div>
              <p>{activeSubTab === 'ready' ? 'No orders ready for pickup.' : 'No paid orders yet.'}</p>
            </div>
          )}
        </div>
      )}

      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <h2>Order Details #{selectedOrder.daily_order_code || selectedOrder.id.slice(0,4)}</h2>
              <button className="close-btn" onClick={() => setSelectedOrder(null)}>×</button>
            </div>
            <div className="modal-body" style={{ marginTop: '1rem' }}>
              <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div><strong>Customer:</strong> {selectedOrder.customer_name}</div>
                 <div><strong>Phone:</strong> {maskPhone(selectedOrder.customer_phone)} {selectedOrder.is_flagged && <span style={{ fontSize: '0.7rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '0.1rem 0.3rem', borderRadius: '0.25rem', border: '1px solid rgba(239, 68, 68, 0.3)', marginLeft: '0.5rem' }}>⚠️ FLAGGED PHONE</span>}</div>
                <div><strong>Status:</strong> <span className="status-pill pill-paid">{selectedOrder.status}</span></div>
                <div><strong>Payment Type:</strong> {selectedOrder.payment_type}</div>
                <div><strong>Time Settled:</strong> {new Date(selectedOrder.updated_at || selectedOrder.created_at).toLocaleString()}</div>
                {selectedOrder.notes && <div><strong>Notes:</strong> {selectedOrder.notes}</div>}
              </div>
              
              <h4 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>Items</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                {selectedOrder.lines?.map(line => (
                  <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{line.quantity}x {line.name}</span>
                    <span>${Number(line.line_subtotal || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Subtotal</span><span>${Number(selectedOrder.subtotal || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Tax</span><span>${Number(selectedOrder.tax || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '0.5rem' }}>
                  <span>Total</span><span>${Number(selectedOrder.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              {selectedOrder.status === 'READY_FOR_PICKUP' && (
                successMsg[selectedOrder.id] ? (
                  <span style={{ color: 'var(--status-normal)', fontWeight: 600, marginRight: 'auto' }}>✓ Settled!</span>
                ) : (
                  <>
                    <button className="btn btn-outline" style={{ borderColor: 'var(--accent-secondary)', color: 'var(--accent-secondary)' }} onClick={() => { handleTenderSelect(selectedOrder.id, 'Credit Card'); handleConfirmPay(selectedOrder.id); }}>💳 Credit Card</button>
                    <button className="btn btn-outline" style={{ borderColor: 'var(--status-normal)', color: 'var(--status-normal)' }} onClick={() => { handleTenderSelect(selectedOrder.id, 'Cash'); handleConfirmPay(selectedOrder.id); }}>💵 Cash</button>
                  </>
                )
              )}
              <button className="btn btn-outline" onClick={() => setSelectedOrder(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
