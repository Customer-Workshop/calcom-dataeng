import React, { useState, useEffect, useRef, useMemo } from 'react';
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
      ssn_last_four: '', dob_month: '', dob_day: '', dob_year: '', address_street: '', address_city: '',
      address_state: 'TX', address_zip: '', employer_name: '', employment_status: 'employed',
      annual_income: '', monthly_debt_payments: '', income_source: 'salary', years_employed: '',
    },
  });
  const [dobError, setDobError] = useState('');
  const dayRef = useRef(null);
  const yearRef = useRef(null);

  const months = useMemo(() => [
    { value: '', label: 'Month' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ], []);

  const daysInMonth = useMemo(() => {
    const m = parseInt(form.borrower_info.dob_month) || 0;
    const y = parseInt(form.borrower_info.dob_year) || 2000;
    if (m === 0) return 31;
    return new Date(y, m, 0).getDate();
  }, [form.borrower_info.dob_month, form.borrower_info.dob_year]);

  const dayOptions = useMemo(() => {
    const opts = [{ value: '', label: 'Day' }];
    for (let d = 1; d <= daysInMonth; d++) {
      opts.push({ value: String(d), label: String(d) });
    }
    return opts;
  }, [daysInMonth]);

  useEffect(() => {
    api.get('/admin/loan-products').then(res => setProducts(res.data)).catch(() => {});
  }, []);

  const updateBorrowerInfo = (field, value) => {
    setForm(prev => ({ ...prev, borrower_info: { ...prev.borrower_info, [field]: value } }));
  };

  const validateDob = () => {
    const { dob_month, dob_day, dob_year } = form.borrower_info;
    if (!dob_month || !dob_day || !dob_year) return '';
    const month = parseInt(dob_month);
    const day = parseInt(dob_day);
    const year = parseInt(dob_year);
    if (month < 1 || month > 12) return 'Month must be 1-12';
    if (day < 1 || day > 31) return 'Day must be 1-31';
    const currentYear = new Date().getFullYear();
    if (year < 1920 || year > currentYear - 18) return `Year must be between 1920 and ${currentYear - 18}`;
    const dob = new Date(year, month - 1, day);
    if (dob.getMonth() !== month - 1) return 'Invalid date for this month';
    const age = (new Date() - dob) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 18) return 'Applicant must be at least 18 years old';
    if (age > 120) return 'Please enter a valid birth year';
    return '';
  };

  const handleMonthChange = (value) => {
    updateBorrowerInfo('dob_month', value);
    setDobError('');
    if (value && dayRef.current) dayRef.current.focus();
  };

  const handleDayChange = (value) => {
    updateBorrowerInfo('dob_day', value);
    setDobError('');
    if (value && yearRef.current) yearRef.current.focus();
  };

  const handleYearChange = (value) => {
    const numOnly = value.replace(/\D/g, '').slice(0, 4);
    updateBorrowerInfo('dob_year', numOnly);
    setDobError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const dobErr = validateDob();
    if (dobErr) { setDobError(dobErr); setStep(2); return; }
    setDobError('');
    const { dob_month, dob_day, dob_year, ...restBorrower } = form.borrower_info;
    const date_of_birth = `${dob_year}-${dob_month.padStart(2, '0')}-${dob_day.padStart(2, '0')}`;
    try {
      const payload = {
        ...form,
        loan_product_id: parseInt(form.loan_product_id),
        requested_amount: parseFloat(form.requested_amount),
        term_months: parseInt(form.term_months),
        borrower_info: {
          ...restBorrower,
          date_of_birth,
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
      <div className="mb-6">
        <img src="/images/loan-application.svg" alt="Loan Application" className="w-full h-32 object-contain rounded-xl mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Loan Application</h1>
      </div>

      {/* Step indicator */}
      <nav aria-label="Application progress" className="mb-8">
        <ol className="flex items-center" role="list">
          {['Loan Details', 'Personal Info', 'Income & Employment'].map((label, i) => (
            <li key={label} className="flex items-center flex-1" aria-current={step === i + 1 ? 'step' : undefined}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}
                aria-hidden="true">
                {i + 1}
              </div>
              <span className={`ml-2 text-sm ${step === i + 1 ? 'text-primary-700 font-medium' : 'text-gray-500'}`}>
                <span className="sr-only">Step {i + 1}{step > i + 1 ? ' (completed)' : step === i + 1 ? ' (current)' : ''}: </span>
                {label}
              </span>
              {i < 2 && <div className="flex-1 h-px bg-gray-200 mx-3" aria-hidden="true" />}
            </li>
          ))}
        </ol>
        <div aria-live="polite" className="sr-only">Step {step} of 3</div>
      </nav>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 text-sm" role="alert" aria-live="assertive">
          <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" aria-hidden="true" />{error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6" aria-label="Loan application form">
        {/* Step 1: Loan Details */}
        {step === 1 && (
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">Loan Details</legend>
            <div>
              <label htmlFor="loan-product" className="block text-sm font-medium text-gray-700 mb-1">Loan Product</label>
              <select id="loan-product" value={form.loan_product_id} onChange={(e) => setForm({ ...form, loan_product_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" required aria-required="true">
                <option value="">Select a product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.min_rate}% - {p.max_rate}%)</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="loan-amount" className="block text-sm font-medium text-gray-700 mb-1">Loan Amount ($)</label>
                <input id="loan-amount" type="number" value={form.requested_amount} onChange={(e) => setForm({ ...form, requested_amount: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" required min="1000" aria-required="true" />
              </div>
              <div>
                <label htmlFor="loan-term" className="block text-sm font-medium text-gray-700 mb-1">Term (months)</label>
                <input id="loan-term" type="number" value={form.term_months} onChange={(e) => setForm({ ...form, term_months: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" required min="12" max="360" aria-required="true" />
              </div>
            </div>
            <div>
              <label htmlFor="loan-purpose" className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
              <input id="loan-purpose" type="text" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" required placeholder="e.g., Vehicle purchase, Home improvement" aria-required="true" />
            </div>
            <div>
              <label htmlFor="loan-state" className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <select id="loan-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}
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
          </fieldset>
        )}

        {/* Step 2: Personal Info */}
        {step === 2 && (
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">Personal Information</legend>
            <div>
              <label htmlFor="ssn-last4" className="block text-sm font-medium text-gray-700 mb-1">SSN (last 4 digits)</label>
              <input id="ssn-last4" type="text" value={form.borrower_info.ssn_last_four} onChange={(e) => updateBorrowerInfo('ssn_last_four', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" maxLength={4} pattern="\d{4}" placeholder="1234" autoComplete="off" />
            </div>
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</legend>
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-start" role="group" aria-describedby={dobError ? 'dob-error' : undefined}>
                <div>
                  <label htmlFor="dob-month" className="sr-only">Birth month</label>
                  <select
                    id="dob-month"
                    value={form.borrower_info.dob_month}
                    onChange={(e) => handleMonthChange(e.target.value)}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white appearance-none cursor-pointer text-sm ${
                      dobError ? 'border-red-400 ring-1 ring-red-300' : 'border-gray-300'
                    } ${!form.borrower_info.dob_month ? 'text-gray-400' : 'text-gray-900'}`}
                    aria-label="Birth month"
                    aria-invalid={dobError ? 'true' : undefined}
                    aria-required="true"
                    autoComplete="bday-month"
                  >
                    {months.map((m) => (
                      <option key={m.value} value={m.value} disabled={m.value === ''}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="w-20">
                  <label htmlFor="dob-day" className="sr-only">Birth day</label>
                  <select
                    id="dob-day"
                    ref={dayRef}
                    value={form.borrower_info.dob_day}
                    onChange={(e) => handleDayChange(e.target.value)}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white appearance-none cursor-pointer text-sm ${
                      dobError ? 'border-red-400 ring-1 ring-red-300' : 'border-gray-300'
                    } ${!form.borrower_info.dob_day ? 'text-gray-400' : 'text-gray-900'}`}
                    aria-label="Birth day"
                    aria-invalid={dobError ? 'true' : undefined}
                    aria-required="true"
                    autoComplete="bday-day"
                  >
                    {dayOptions.map((d) => (
                      <option key={d.value} value={d.value} disabled={d.value === ''}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label htmlFor="dob-year" className="sr-only">Birth year</label>
                  <input
                    id="dob-year"
                    ref={yearRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Year"
                    value={form.borrower_info.dob_year}
                    onChange={(e) => handleYearChange(e.target.value)}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-center text-sm ${
                      dobError ? 'border-red-400 ring-1 ring-red-300' : 'border-gray-300'
                    }`}
                    maxLength={4}
                    aria-label="Birth year"
                    aria-invalid={dobError ? 'true' : undefined}
                    aria-required="true"
                    autoComplete="bday-year"
                  />
                </div>
              </div>
              {dobError && (
                <p id="dob-error" className="text-xs text-red-600 mt-2 flex items-center" role="alert" aria-live="assertive">
                  <AlertCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" aria-hidden="true" />
                  {dobError}
                </p>
              )}
            </fieldset>
            <div>
              <label htmlFor="address-street" className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <input id="address-street" type="text" value={form.borrower_info.address_street} onChange={(e) => updateBorrowerInfo('address_street', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" autoComplete="street-address" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="address-city" className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input id="address-city" type="text" value={form.borrower_info.address_city} onChange={(e) => updateBorrowerInfo('address_city', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" autoComplete="address-level2" />
              </div>
              <div>
                <label htmlFor="address-state" className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select id="address-state" value={form.borrower_info.address_state} onChange={(e) => updateBorrowerInfo('address_state', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" autoComplete="address-level1">
                  <option value="TX">TX</option><option value="FL">FL</option><option value="OH">OH</option>
                </select>
              </div>
              <div>
                <label htmlFor="address-zip" className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                <input id="address-zip" type="text" value={form.borrower_info.address_zip} onChange={(e) => updateBorrowerInfo('address_zip', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" maxLength={10} autoComplete="postal-code" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Back</button>
              <button type="button" onClick={() => setStep(3)} className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700">Next: Income</button>
            </div>
          </fieldset>
        )}

        {/* Step 3: Income & Employment */}
        {step === 3 && (
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">Income & Employment</legend>
            <div>
              <label htmlFor="employment-status" className="block text-sm font-medium text-gray-700 mb-1">Employment Status</label>
              <select id="employment-status" value={form.borrower_info.employment_status} onChange={(e) => updateBorrowerInfo('employment_status', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                <option value="employed">Employed</option>
                <option value="self_employed">Self-Employed</option>
                <option value="retired">Retired</option>
                <option value="unemployed">Unemployed</option>
              </select>
            </div>
            <div>
              <label htmlFor="employer-name" className="block text-sm font-medium text-gray-700 mb-1">Employer Name</label>
              <input id="employer-name" type="text" value={form.borrower_info.employer_name} onChange={(e) => updateBorrowerInfo('employer_name', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" autoComplete="organization" />
            </div>
            <div>
              <label htmlFor="income-source" className="block text-sm font-medium text-gray-700 mb-1">Income Source</label>
              <select id="income-source" value={form.borrower_info.income_source} onChange={(e) => updateBorrowerInfo('income_source', e.target.value)}
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
                <label htmlFor="annual-income" className="block text-sm font-medium text-gray-700 mb-1">Annual Income ($)</label>
                <input id="annual-income" type="number" value={form.borrower_info.annual_income} onChange={(e) => updateBorrowerInfo('annual_income', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" min="0" />
              </div>
              <div>
                <label htmlFor="monthly-debt" className="block text-sm font-medium text-gray-700 mb-1">Monthly Debt Payments ($)</label>
                <input id="monthly-debt" type="number" value={form.borrower_info.monthly_debt_payments} onChange={(e) => updateBorrowerInfo('monthly_debt_payments', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" min="0" />
              </div>
            </div>
            <div>
              <label htmlFor="years-employed" className="block text-sm font-medium text-gray-700 mb-1">Years Employed</label>
              <input id="years-employed" type="number" value={form.borrower_info.years_employed} onChange={(e) => updateBorrowerInfo('years_employed', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" min="0" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(2)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Back</button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                aria-busy={loading}>
                <Send className="w-4 h-4 mr-2" aria-hidden="true" />{loading ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </fieldset>
        )}
      </form>
    </div>
  );
}
