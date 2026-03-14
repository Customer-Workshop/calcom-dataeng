import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, AlertCircle } from 'lucide-react';
import useStore from '../store/useStore';

const DEMO_ACCOUNTS = [
  { email: 'borrower1@example.com', role: 'Borrower', password: 'Password123!' },
  { email: 'lo1@republicfinance.com', role: 'Loan Officer', password: 'Password123!' },
  { email: 'bm1@republicfinance.com', role: 'Branch Manager', password: 'Password123!' },
  { email: 'uw1@republicfinance.com', role: 'Underwriter', password: 'Password123!' },
  { email: 'compliance@republicfinance.com', role: 'Compliance', password: 'Password123!' },
  { email: 'admin@republicfinance.com', role: 'System Admin', password: 'Password123!' },
  { email: 'exec@republicfinance.com', role: 'Executive', password: 'Password123!' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await login(email, password);
      const routes = {
        borrower: '/borrower', loan_officer: '/officer', branch_manager: '/manager',
        underwriter: '/underwriter', compliance_officer: '/compliance',
        system_admin: '/admin', executive: '/executive',
      };
      navigate(routes[user.role] || '/');
    } catch (err) {
      setError(err.message);
    }
  };

  const quickLogin = (account) => {
    setEmail(account.email);
    setPassword(account.password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
              <LogIn className="w-8 h-8 text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Republic Finance</h1>
            <p className="text-gray-500 mt-1">Loan Origination System</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="you@example.com" required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="Enter your password" required
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/register" className="text-sm text-primary-600 hover:text-primary-700">
              New borrower? Create an account
            </Link>
          </div>

          <div className="mt-6 border-t pt-4">
            <p className="text-xs text-gray-500 mb-3 text-center">Quick Demo Login (all use Password123!)</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  onClick={() => quickLogin(account)}
                  className="px-2 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600 transition-colors truncate"
                  title={account.email}
                >
                  {account.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
