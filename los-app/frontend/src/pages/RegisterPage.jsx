import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, AlertCircle } from 'lucide-react';
import useStore from '../store/useStore';

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', phone: '' });
  const [error, setError] = useState('');
  const { register, loading } = useStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register(form);
      navigate('/borrower');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-900 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8" role="region" aria-label="Registration">
        <div className="text-center mb-6">
          <img src="/images/logo.svg" alt="Republic Finance" className="h-14 mx-auto mb-3" />
          <h1 className="sr-only">Republic Finance - Create Borrower Account</h1>
          <p className="text-gray-500 mt-1">Create your borrower account</p>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 text-sm" role="alert" aria-live="assertive">
            <AlertCircle className="w-4 h-4 mr-2" aria-hidden="true" />{error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3" aria-label="Registration form">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="reg-first-name" className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input id="reg-first-name" type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" required autoComplete="given-name" aria-required="true" />
            </div>
            <div>
              <label htmlFor="reg-last-name" className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input id="reg-last-name" type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" required autoComplete="family-name" aria-required="true" />
            </div>
          </div>
          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input id="reg-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" required autoComplete="email" aria-required="true" />
          </div>
          <div>
            <label htmlFor="reg-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-gray-400">(optional)</span></label>
            <input id="reg-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" autoComplete="tel" />
          </div>
          <div>
            <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input id="reg-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" required minLength={8} autoComplete="new-password" aria-required="true"
              aria-describedby="password-hint" />
            <p id="password-hint" className="text-xs text-gray-400 mt-1">Minimum 12 characters with uppercase, lowercase, number, and special character</p>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
            aria-busy={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <Link to="/login" className="text-sm text-primary-600 hover:text-primary-700 underline">Already have an account? Sign in</Link>
        </div>
      </div>
    </div>
  );
}
