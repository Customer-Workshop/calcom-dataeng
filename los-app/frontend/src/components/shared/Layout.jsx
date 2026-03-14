import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { LogOut, Menu, X, Home, FileText, Users, Shield, Settings, BarChart3, ClipboardCheck, Building2 } from 'lucide-react';
import useStore from '../../store/useStore';

const roleNavItems = {
  borrower: [
    { path: '/borrower', label: 'My Dashboard', icon: Home },
    { path: '/borrower/apply', label: 'Apply for Loan', icon: FileText },
  ],
  loan_officer: [
    { path: '/officer', label: 'Pipeline', icon: Home },
  ],
  branch_manager: [
    { path: '/manager', label: 'Branch Pipeline', icon: Building2 },
  ],
  underwriter: [
    { path: '/underwriter', label: 'Review Queue', icon: ClipboardCheck },
  ],
  compliance_officer: [
    { path: '/compliance', label: 'Compliance Panel', icon: Shield },
  ],
  system_admin: [
    { path: '/admin', label: 'Admin Console', icon: Settings },
    { path: '/executive', label: 'Reports', icon: BarChart3 },
  ],
  executive: [
    { path: '/executive', label: 'Dashboard', icon: BarChart3 },
  ],
};

const roleLabels = {
  borrower: 'Borrower Portal',
  loan_officer: 'Loan Officer',
  branch_manager: 'Branch Manager',
  underwriter: 'Underwriter',
  compliance_officer: 'Compliance',
  system_admin: 'System Admin',
  executive: 'Executive',
};

export default function Layout() {
  const { user, logout } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);
  const menuButtonRef = useRef(null);

  const navItems = roleNavItems[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  // Focus first focusable element when sidebar opens on mobile
  useEffect(() => {
    if (sidebarOpen && sidebarRef.current) {
      const focusable = sidebarRef.current.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) focusable[0].focus();
    }
  }, [sidebarOpen]);

  // Update document title on navigation
  useEffect(() => {
    const pageTitle = roleLabels[user?.role] || 'Republic Finance';
    document.title = `${pageTitle} - Republic Finance LOS`;
  }, [location.pathname, user?.role]);

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Skip Navigation Link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        id="sidebar-nav"
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-200 lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between h-16 px-4 border-b bg-primary-700">
            <img src="/images/logo-white.svg" alt="Republic Finance - Home" className="h-9" />
            <button
              onClick={() => { setSidebarOpen(false); menuButtonRef.current?.focus(); }}
              className="lg:hidden text-white"
              aria-label="Close navigation menu"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          
          <div className="px-4 py-3 border-b bg-primary-50" aria-label="Current user">
            <p className="text-sm font-medium text-primary-900">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-primary-600">{roleLabels[user?.role]}</p>
          </div>

          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto" aria-label="Sidebar">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-primary-100 text-primary-800' : 'text-gray-700 hover:bg-primary-50 hover:text-primary-700'}`}
                  onClick={() => setSidebarOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon className="mr-3 h-5 w-5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t">
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
              aria-label="Sign out of your account"
            >
              <LogOut className="mr-3 h-5 w-5" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => { setSidebarOpen(false); menuButtonRef.current?.focus(); }}
          aria-hidden="true"
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 bg-white border-b h-16 flex items-center px-4 shadow-sm" role="banner">
          <button
            ref={menuButtonRef}
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden mr-4 text-gray-600"
            aria-label="Open navigation menu"
            aria-expanded={sidebarOpen}
            aria-controls="sidebar-nav"
          >
            <Menu size={24} aria-hidden="true" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">{roleLabels[user?.role]}</h1>
        </header>
        <main id="main-content" className="flex-1 p-4 lg:p-6 overflow-auto" role="main" tabIndex={-1}>
          <div aria-live="polite" aria-atomic="true" className="sr-only" id="page-announcer" />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
