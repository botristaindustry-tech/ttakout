import React, { useState, useEffect } from 'react';
import '../pages/Admin.css';
import './AdminUsers.css';

const PERMISSION_GROUPS = [
  {
    category: 'NAVIGATION',
    items: [
      { id: 'view_analytics', name: 'Incoming Orders', desc: 'View and manage incoming orders' },
      { id: 'view_kds', name: 'KDS', desc: 'Access the kitchen display system' },
      { id: 'view_settlement', name: 'Orders for Pickup', desc: 'View orders ready for pickup' },
      { id: 'view_dashboard', name: 'Activity Dashboard', desc: 'Access the activity dashboard and reports' }
    ]
  },
  {
    category: 'ADMIN',
    items: [
      { id: 'manage_kds', name: 'KDS Setup', desc: 'Manage kitchen display settings and layouts' },
      { id: 'manage_users', name: 'Roles & Users', desc: 'Add, edit, or remove users and roles' }
    ]
  }
];

export default function AdminUsers() {
  const [activeTab, setActiveTab] = useState('users');
  
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Role Form
  const [newRoleName, setNewRoleName] = useState('');
  
  // Assign User Form
  const [assignForm, setAssignForm] = useState({ name: '', email: '', role: '' });
  
  // Edit User State
  const [editingUserId, setEditingUserId] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', role: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/users`, { credentials: 'include' }),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/roles`, { credentials: 'include' })
      ]);
      
      const [uData, rData] = await Promise.all([uRes.json(), rRes.json()]);
      
      if (Array.isArray(uData)) setUsers(uData);
      if (Array.isArray(rData)) setRoles(rData);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- Roles & Permissions Matrix Methods ---

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newRoleName, permissions: [] })
      });
      if (res.ok) {
        const newRole = await res.json();
        setRoles([...roles, newRole]);
        setNewRoleName('');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create role');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleTogglePermission = async (roleName, permId, currentPerms) => {
    const updatedPerms = currentPerms.includes(permId)
      ? currentPerms.filter(p => p !== permId)
      : [...currentPerms, permId];

    // Optimistic UI update
    setRoles(prev => prev.map(r => r.name === roleName ? { ...r, permissions: updatedPerms } : r));

    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/roles/${roleName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ permissions: updatedPerms })
      });
    } catch (err) {
      alert('Error updating permission');
      fetchData(); // Revert on error
    }
  };

  const handleDeleteRole = async (roleName) => {
    if (!window.confirm(`Are you sure you want to delete the ${roleName} role?`)) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/roles/${roleName}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setRoles(roles.filter(r => r.name !== roleName));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete role');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // --- User Management Methods ---

  const handleAssignUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(assignForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add user');
      
      setUsers([data, ...users]);
      setAssignForm({ name: '', email: '', role: '' });
    } catch (err) {
      alert('Error adding user: ' + err.message);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/users/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== id));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete user');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const startEditUser = (user) => {
    setEditingUserId(user.id);
    setEditFormData({ name: user.name, role: user.role });
  };

  const saveEditUser = async (user) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...user, name: editFormData.name, role: editFormData.role })
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setUsers(users.map(u => u.id === user.id ? updatedUser : u));
        setEditingUserId(null);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update user');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading data...</div>;

  return (
    <div className="admin-users-page" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Users & Roles</h2>
      </div>

      <div className="users-tabs">
        <button 
          className={`users-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Administrative Users
        </button>
        <button 
          className={`users-tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          Roles & Permissions Matrix
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="users-table-container">
          <h3>Users with Access at This Location</h3>
          
          <table className="matrix-table" style={{ marginBottom: '2rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Name</th>
                <th style={{ textAlign: 'left' }}>Email</th>
                <th style={{ textAlign: 'left' }}>Role</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {editingUserId === u.id ? (
                    <>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={editFormData.name} 
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          style={{ padding: '0.4rem', fontSize: '0.9rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <select 
                          className="form-input"
                          value={editFormData.role}
                          onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                          style={{ padding: '0.4rem', fontSize: '0.9rem' }}
                        >
                          {roles.map(r => (
                            <option key={r.name} value={r.name}>{r.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                        <button className="user-action-btn" onClick={() => saveEditUser(u)} title="Save" style={{ color: 'var(--status-normal)' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        </button>
                        <button className="user-action-btn" onClick={() => setEditingUserId(null)} title="Cancel">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{u.name}</td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{u.role}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                        <button className="user-action-btn" onClick={() => startEditUser(u)} title="Edit">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button className="user-action-btn delete" onClick={() => handleDeleteUser(u.id)} title="Remove">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="assign-user-section">
            <h4>Assign User to Role</h4>
            <form onSubmit={handleAssignUser} className="assign-user-form">
              <div className="form-group">
                <label style={{ fontSize: '0.85rem' }}>Name</label>
                <input 
                  required 
                  type="text" 
                  className="form-input" 
                  placeholder="Jane Doe"
                  value={assignForm.name}
                  onChange={e => setAssignForm({ ...assignForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.85rem' }}>Google Email</label>
                <input 
                  required 
                  type="email" 
                  className="form-input" 
                  placeholder="jane@example.com"
                  value={assignForm.email}
                  onChange={e => setAssignForm({ ...assignForm, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.85rem' }}>Role</label>
                <select 
                  required
                  className="form-input"
                  value={assignForm.role}
                  onChange={e => setAssignForm({ ...assignForm, role: e.target.value })}
                >
                  <option value="" disabled>Select Role...</option>
                  {roles.map(r => (
                    <option key={r.name} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
                Assign User
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="matrix-container">
          <div className="matrix-header-actions">
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Permissions Matrix</h3>
            <form onSubmit={handleCreateRole} className="new-role-form">
              <input 
                required
                type="text" 
                className="form-input" 
                placeholder="New Role Name (e.g. Shift 1)" 
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem', width: '250px' }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
                Create Role
              </button>
            </form>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="matrix-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Permission</th>
                  {roles.map(r => (
                    <th key={r.name}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        {r.name}
                        {r.name !== 'ADMIN' && (
                          <button 
                            onClick={() => handleDeleteRole(r.name)} 
                            className="user-action-btn delete" 
                            style={{ padding: 0 }}
                            title="Delete Role"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map(group => (
                  <React.Fragment key={group.category}>
                    <tr className="matrix-category-row">
                      <td colSpan={roles.length + 1}>{group.category}</td>
                    </tr>
                    {group.items.map(perm => (
                      <tr key={perm.id} className="matrix-perm-row">
                        <td>
                          <div className="perm-title">{perm.name}</div>
                          <div className="perm-desc">{perm.desc}</div>
                        </td>
                        {roles.map(role => (
                          <td key={`${role.name}-${perm.id}`}>
                            <input 
                              type="checkbox" 
                              className="matrix-checkbox"
                              checked={(role.permissions || []).includes(perm.id)}
                              onChange={() => handleTogglePermission(role.name, perm.id, role.permissions || [])}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
