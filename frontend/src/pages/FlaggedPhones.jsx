import React, { useState, useEffect } from 'react';
import './FlaggedPhones.css';

export default function FlaggedPhones() {
  const [flaggedList, setFlaggedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-populated date display (formatted for view)
  const todayStr = new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  useEffect(() => {
    fetchFlaggedPhones();
  }, []);

  const fetchFlaggedPhones = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/flagged-phones`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setFlaggedList(data);
      }
    } catch (err) {
      console.error('Failed to fetch flagged phones:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!phone.trim() || !name.trim()) {
      setErrorMsg('Phone number and name are required.');
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/flagged-phones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone_number: phone.trim(),
          name: name.trim(),
          notes: notes.trim()
        })
      });

      if (res.ok) {
        const newRecord = await res.json();
        setSuccessMsg(`Successfully flagged ${newRecord.phone_number}`);
        setPhone('');
        setName('');
        setNotes('');
        fetchFlaggedPhones();
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || 'Failed to save flagged phone.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to connect to the server.');
    }
  };

  const handleDelete = async (id, phoneNumber) => {
    if (!window.confirm(`Are you sure you want to remove ${phoneNumber} from the flagged list?`)) {
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/flagged-phones/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        setSuccessMsg(`Successfully removed ${phoneNumber} from flagged list.`);
        fetchFlaggedPhones();
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || 'Failed to delete flagged phone.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to delete flagged phone.');
    }
  };

  return (
    <div className="flagged-page">
      <div className="flagged-header">
        <div>
          <h1>Flagged Phone Numbers</h1>
          <p className="flagged-subtitle">Track and identify customer numbers flagged for orders</p>
        </div>
      </div>

      <div className="flagged-grid">
        {/* Form panel */}
        <div className="flagged-panel form-panel glass-panel">
          <h2>Flag New Number</h2>
          <p className="panel-hint">Key in information to flag a customer phone number.</p>

          <form onSubmit={handleSubmit} className="flagged-form">
            <div className="form-group">
              <label htmlFor="phoneNumber">Phone Number</label>
              <input
                id="phoneNumber"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="personName">Customer Name</label>
              <input
                id="personName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="flaggedDate">Date (Auto-populated)</label>
              <input
                id="flaggedDate"
                type="text"
                value={todayStr}
                className="form-input read-only-input"
                readOnly
              />
            </div>

            <div className="form-group">
              <label htmlFor="flaggedNotes">Notes / Reason</label>
              <textarea
                id="flaggedNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Provide notes or reasons for flagging this phone number..."
                className="form-textarea"
                rows="4"
              />
            </div>

            {errorMsg && <div className="message-box error-box">{errorMsg}</div>}
            {successMsg && <div className="message-box success-box">{successMsg}</div>}

            <button type="submit" className="btn btn-primary submit-btn">
              Flag Number
            </button>
          </form>
        </div>

        {/* History panel */}
        <div className="flagged-panel history-panel glass-panel">
          <h2>Historical Records</h2>
          <p className="panel-hint">List of all currently flagged numbers in the system.</p>

          {loading ? (
            <div className="loading-state">Loading records...</div>
          ) : flaggedList.length === 0 ? (
            <div className="empty-state">No flagged numbers recorded yet.</div>
          ) : (
            <div className="history-table-wrapper">
              <table className="admin-table flagged-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Phone Number</th>
                    <th>Date Added</th>
                    <th>Notes</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {flaggedList.map((item) => (
                    <tr key={item.id} className="flagged-row">
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td style={{ color: 'var(--accent-primary)', fontFamily: 'monospace' }}>{item.phone_number}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="notes-cell" title={item.notes}>{item.notes || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-outline delete-btn"
                          onClick={() => handleDelete(item.id, item.phone_number)}
                          style={{
                            borderColor: 'var(--status-critical)',
                            color: 'var(--status-critical)',
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.75rem'
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
