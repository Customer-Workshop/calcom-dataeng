import React, { useState } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = roleNavItems[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-200 lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between h-16 px-4 border-b bg-primary-700">
            <h1 className="text-white font-bold text-lg">Republic Finance</h1>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white">
              <X size={20} />
            </button>
          </div>
          
          <div className="px-4 py-3 border-b bg-primary-50">
            <p className="text-sm font-medium text-primary-900">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-primary-600">{roleLabels[user?.role]}</p>
          </div>

          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t">
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 bg-white border-b h-16 flex items-center px-4 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-4 text-gray-600">
            <Menu size={24} />
          </button>
          <h2 className="text-lg font-semibold text-gray-800">{roleLabels[user?.role]}</h2>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
