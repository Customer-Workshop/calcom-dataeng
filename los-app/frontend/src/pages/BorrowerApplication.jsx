import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, AlertCircle } from 'lucide-react';
import useStore from '../store/useStore';
import api from '../utils/api';

export default function BorrowerApplication() {
  const { createApplication, loading } = useStore();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    loan_product_id: '', requested_amount: '', term_months: '', purpose: '', state: 'TX',
    borrower_info: {
      ssn_last_four: '', date_of_birth: '', address_street: '', address_city: '',
      address_state: 'TX', address_zip: '', employer_name: '', employment_status: 'employed',
      annual_income: '', monthly_debt_payments: '', income_source: 'salary', years_employed: '',
    },
  });

  useEffect(() => {
    api.get('/admin/loan-products').then(res => setProducts(res.data)).catch(() => {});
  }, []);

  const updateBorrowerInfo = (field, value) => {
    setForm(prev => ({ ...prev, borrower_info: { ...prev.borrower_info, [field]: value } }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...form,
        loan_product_id: parseInt(form.loan_product_id),
        requested_amount: parseFloat(form.requested_amount),
        term_months: parseInt(form.term_months),
        borrower_info: {
          ...form.borrower_info,
          annual_income: parseFloat(form.borrower_info.annual_income) || 0,
          monthly_debt_payments: parseFloat(form.borrower_info.monthly_debt_payments) || 0,
          years_employed: parseInt(form.borrower_info.years_employed) || 0,
        },
      };
      const app = await createApplication(payload);
      navigate(`/application/${app.id}`);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.details?.[0]?.message || 'Application submission failed');
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Loan Application</h1>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {['Loan Details', 'Personal Info', 'Income & Employment'].map((label, i) => (
          <div key={label} className="flex items-center flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {i + 1}
            </div>
            <span className={`ml-2 text-sm ${step === i + 1 ? 'text-primary-700 font-medium' : 'text-gray-500'}`}>{label}</span>
            {i < 2 && <div className="flex-1 h-px bg-gray-200 mx-3" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />{error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6">
        {/* Step 1: Loan Details */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Loan Details</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loan Product</label>
              <select value={form.loan_product_id} onChange={(e) => setForm({ ...form, loan_product_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" required>
                <option value="">Select a product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.min_rate}% - {p.max_rate}%)</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount ($)</label>
                <input type="number" value={form.requested_amount} onChange={(e) => setForm({ ...form, requested_amount: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" required min="1000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term (months)</label>
                <input type="number" value={form.term_months} onChange={(e) => setForm({ ...form, term_months: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" required min="12" max="360" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
              <input type="text" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" required placeholder="e.g., Vehicle purchase, Home improvement" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                <option value="TX">Texas</option>
                <option value="FL">Florida</option>
                <option value="OH">Ohio</option>
              </select>
            </div>
            <button type="button" onClick={() => setStep(2)}
              className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors">
              Next: Personal Info
            </button>
          </div>
        )}

        {/* Step 2: Personal Info */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Personal Information</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SSN (last 4 digits)</label>
              <input type="text" value={form.borrower_info.ssn_last_four} onChange={(e) => updateBorrowerInfo('ssn_last_four', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" maxLength={4} pattern="\d{4}" placeholder="1234" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input type="date" value={form.borrower_info.date_of_birth} onChange={(e) => updateBorrowerInfo('date_of_birth', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <input type="text" value={form.borrower_info.address_street} onChange={(e) => updateBorrowerInfo('address_street', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input type="text" value={form.borrower_info.address_city} onChange={(e) => updateBorrowerInfo('address_city', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select value={form.borrower_info.address_state} onChange={(e) => updateBorrowerInfo('address_state', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                  <option value="TX">TX</option><option value="FL">FL</option><option value="OH">OH</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                <input type="text" value={form.borrower_info.address_zip} onChange={(e) => updateBorrowerInfo('address_zip', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" maxLength={10} />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Back</button>
              <button type="button" onClick={() => setStep(3)} className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700">Next: Income</button>
            </div>
          </div>
        )}

        {/* Step 3: Income & Employment */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Income & Employment</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employment Status</label>
              <select value={form.borrower_info.employment_status} onChange={(e) => updateBorrowerInfo('employment_status', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                <option value="employed">Employed</option>
                <option value="self_employed">Self-Employed</option>
                <option value="retired">Retired</option>
                <option value="unemployed">Unemployed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employer Name</label>
              <input type="text" value={form.borrower_info.employer_name} onChange={(e) => updateBorrowerInfo('employer_name', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Income Source</label>
              <select value={form.borrower_info.income_source} onChange={(e) => updateBorrowerInfo('income_source', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                <option value="salary">Salary</option>
                <option value="sso">SSO/Social Security</option>
                <option value="pension">Pension</option>
                <option value="business">Business Income</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Annual Income ($)</label>
                <input type="number" value={form.borrower_info.annual_income} onChange={(e) => updateBorrowerInfo('annual_income', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Debt Payments ($)</label>
                <input type="number" value={form.borrower_info.monthly_debt_payments} onChange={(e) => updateBorrowerInfo('monthly_debt_payments', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" min="0" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Years Employed</label>
              <input type="number" value={form.borrower_info.years_employed} onChange={(e) => updateBorrowerInfo('years_employed', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" min="0" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(2)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Back</button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center">
                <Send className="w-4 h-4 mr-2" />{loading ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
