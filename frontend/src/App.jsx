import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { useOrderStore } from './store/orderStore';
import IngestionDashboard from './pages/IngestionDashboard';
import KDS from './pages/KDS';
import Settlement from './pages/Settlement';
import AdminKdsSetup from './components/AdminKdsSetup';
import AdminUsers from './components/AdminUsers';
import AdminDashboard from './pages/AdminDashboard';
import WebhookLogs from './pages/WebhookLogs';
import Login from './pages/Login';
import FlaggedPhones from './pages/FlaggedPhones';
import MenuManager from './pages/MenuManager';
import AdminVapiSetup from './components/AdminVapiSetup';
import AdminVapiBilling from './components/AdminVapiBilling';

function ProtectedRoute({ user, requiredPermission, children, fallback }) {
  const perms = user?.permissions || [];
  if (!perms.includes(requiredPermission)) {
    return <Navigate to={fallback} replace />;
  }
  return children;
}

/* ─── Global Sidebar Drawer ─── */
function SidebarDrawer({ isOpen, onClose, user }) {
  const location = useLocation();
  const perms = user?.permissions || [];
  const [settingsOpen, setSettingsOpen] = useState(
    location.pathname.startsWith('/admin/settings')
  );

  const isActive = (path) => location.pathname === path;

  const handleNav = () => {
    // Don't auto-close on desktop; let user control it
  };

  return (
    <>
      {/* Overlay (dim background when open on mobile) */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`global-sidebar ${isOpen ? 'open' : ''}`}>
        {/* Close / X button at top */}
        <div className="sidebar-top">
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">✕</button>
        </div>

        <nav className="sidebar-menu">
          {/* ── Main App Links ── */}
          {perms.includes('view_analytics') && (
            <Link
              to="/"
              className={`sidebar-item ${isActive('/') ? 'active' : ''}`}
              onClick={handleNav}
            >
              <span className="sidebar-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg></span>
              Incoming Orders
            </Link>
          )}

          {perms.includes('view_kds') && (
            <Link
              to="/kds"
              className={`sidebar-item ${isActive('/kds') ? 'active' : ''}`}
              onClick={handleNav}
            >
              <span className="sidebar-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span>
              KDS
            </Link>
          )}

          {perms.includes('view_settlement') && (
            <Link
              to="/settlement"
              className={`sidebar-item ${isActive('/settlement') ? 'active' : ''}`}
              onClick={handleNav}
            >
              <span className="sidebar-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg></span>
              Orders for Pickup
            </Link>
          )}

            {perms.includes('view_dashboard') && (
              <Link
                to="/admin/dashboard"
                className={`sidebar-item ${isActive('/admin/dashboard') ? 'active' : ''}`}
                onClick={handleNav}
              >
                <span className="sidebar-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg></span>
                Activity Dashboard
              </Link>
            )}

            {(perms.includes('manage_kds') || perms.includes('manage_users')) && (
            <>
              <div className="sidebar-divider" />

              {/* Settings — expandable group */}
              <button
                className={`sidebar-item sidebar-group-toggle ${settingsOpen ? 'expanded' : ''}`}
                onClick={() => setSettingsOpen(!settingsOpen)}
              >
                <span className="sidebar-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg></span>
                Settings
                <span className="sidebar-chevron">{settingsOpen ? '▾' : '›'}</span>
              </button>

              {settingsOpen && (
                <div className="sidebar-sub-menu">
                  {perms.includes('manage_kds') && (
                    <>
                      <Link
                        to="/admin/settings/kds"
                        className={`sidebar-item sub ${isActive('/admin/settings/kds') ? 'active' : ''}`}
                        onClick={handleNav}
                      >
                        KDS Setup
                      </Link>
                      <Link
                        to="/admin/logs"
                        className={`sidebar-item sub ${isActive('/admin/logs') ? 'active' : ''}`}
                        onClick={handleNav}
                      >
                        Webhook Logs
                      </Link>
                      <Link
                        to="/admin/settings/flagged-phones"
                        className={`sidebar-item sub ${isActive('/admin/settings/flagged-phones') ? 'active' : ''}`}
                        onClick={handleNav}
                      >
                        Flagged Phones
                      </Link>
                      <Link
                        to="/admin/settings/menu"
                        className={`sidebar-item sub ${isActive('/admin/settings/menu') ? 'active' : ''}`}
                        onClick={handleNav}
                      >
                        Menu Manager
                      </Link>
                      <Link
                        to="/admin/settings/vapi"
                        className={`sidebar-item sub ${isActive('/admin/settings/vapi') ? 'active' : ''}`}
                        onClick={handleNav}
                      >
                        AI Agent Prompt
                      </Link>
                      <Link
                        to="/admin/settings/vapi-billing"
                        className={`sidebar-item sub ${isActive('/admin/settings/vapi-billing') ? 'active' : ''}`}
                        onClick={handleNav}
                      >
                        VAPI Billing & Logs
                      </Link>
                    </>
                  )}
                </div>
              )}

              {/* Roles and Users */}
              {perms.includes('manage_users') && (
                <Link
                to="/admin/users"
                className={`sidebar-item ${isActive('/admin/users') ? 'active' : ''}`}
                onClick={handleNav}
              >
                <span className="sidebar-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></span>
                Roles and Users
                </Link>
              )}
            </>
          )}
        </nav>
      </aside>
    </>
  );
}

/* ─── Main App ─── */
function App() {
  const { init, user, checkAuth, isAuthLoading } = useOrderStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    checkAuth().then(() => {
      init();
    });
  }, [init, checkAuth]);

  if (isAuthLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Connecting to TTAKOUT Hub...</p>
      </div>
    );
  }

  const userRole = user?.role || 'STAFF';
  const perms = user?.permissions || [];
  const defaultRoute = perms.includes('view_kds') ? '/kds' : (perms.includes('view_analytics') ? '/admin/dashboard' : '/');

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to={defaultRoute} />} />
        
        <Route path="*" element={
          user ? (
            <div className="app-container">
              {/* Global Sidebar */}
              <SidebarDrawer
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                user={user}
              />

              <div className="main-content">
                <header className="top-nav">
                  {/* Hamburger */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                      className="hamburger-toggle"
                      onClick={() => setSidebarOpen(!sidebarOpen)}
                      aria-label="Toggle menu"
                    >
                      ☰
                    </button>
                    <h2 className="text-gradient">TTAKOUT Hub</h2>
                  </div>

                  {/* User Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.9rem' }}>{user.name}</span>
                      <span style={{ 
                        display: 'block', 
                        fontSize: '0.7rem', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.08em',
                        color: userRole === 'ADMIN' ? 'var(--accent-secondary)' : 'var(--text-muted)' 
                      }}>
                        {userRole}
                      </span>
                    </div>
                    <button 
                      className="btn btn-outline" 
                      style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      onClick={() => {
                        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/auth/logout`, { method: 'POST', credentials: 'include' })
                          .then(() => window.location.href = '/login');
                      }}
                    >
                      Logout
                    </button>
                  </div>
                </header>
                
                <main className="content-area">
                  {perms.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', marginTop: '10vh' }}>
                      <h2>No Permissions Assigned</h2>
                      <p>Your account is active, but you don't have any roles or permissions assigned yet.</p>
                      <p>Please contact an Administrator to set up your account access.</p>
                    </div>
                  ) : (
                    <Routes>
                      <Route path="/" element={
                        <ProtectedRoute user={user} requiredPermission="view_analytics" fallback="/kds">
                          <IngestionDashboard />
                        </ProtectedRoute>
                      } />
                      <Route path="/kds" element={
                        <ProtectedRoute user={user} requiredPermission="view_kds" fallback="/">
                          <KDS />
                        </ProtectedRoute>
                      } />
                      <Route path="/settlement" element={
                        <ProtectedRoute user={user} requiredPermission="view_settlement" fallback="/">
                          <Settlement />
                        </ProtectedRoute>
                      } />
                      <Route path="/admin/settings/kds" element={
                        <ProtectedRoute user={user} requiredPermission="manage_kds" fallback="/kds">
                          <AdminKdsSetup />
                        </ProtectedRoute>
                      } />
                      <Route path="/admin/logs" element={
                        <ProtectedRoute user={user} requiredPermission="manage_kds" fallback="/kds">
                          <WebhookLogs />
                        </ProtectedRoute>
                      } />
                      <Route path="/admin/settings/flagged-phones" element={
                        <ProtectedRoute user={user} requiredPermission="manage_kds" fallback="/kds">
                          <FlaggedPhones />
                        </ProtectedRoute>
                      } />
                      <Route path="/admin/settings/menu" element={
                        <ProtectedRoute user={user} requiredPermission="manage_kds" fallback="/kds">
                          <MenuManager />
                        </ProtectedRoute>
                      } />
                      <Route path="/admin/settings/vapi" element={
                        <ProtectedRoute user={user} requiredPermission="manage_kds" fallback="/kds">
                          <AdminVapiSetup />
                        </ProtectedRoute>
                      } />
                      <Route path="/admin/settings/vapi-billing" element={
                        <ProtectedRoute user={user} requiredPermission="manage_kds" fallback="/kds">
                          <AdminVapiBilling />
                        </ProtectedRoute>
                      } />
                      <Route path="/admin/dashboard" element={
                        <ProtectedRoute user={user} requiredPermission="view_dashboard" fallback="/kds">
                          <AdminDashboard />
                        </ProtectedRoute>
                      } />
                      <Route path="/admin/users" element={
                        <ProtectedRoute user={user} requiredPermission="manage_users" fallback="/kds">
                          <AdminUsers />
                        </ProtectedRoute>
                      } />
                      <Route path="*" element={<Navigate to={defaultRoute} replace />} />
                    </Routes>
                  )}
                </main>
              </div>
            </div>
          ) : (
            <Navigate to="/login" />
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

