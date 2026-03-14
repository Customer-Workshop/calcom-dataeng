import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, CreditCard, Shield, DollarSign, CheckCircle, XCircle, PenTool, Upload, Truck, AlertTriangle } from 'lucide-react';
import useStore from '../store/useStore';
import StatusBadge from '../components/shared/StatusBadge';
import api from '../utils/api';

export default function ApplicationDetail() {
  const { id } = useParams();
  const { currentApplication, fetchApplication, user, loading } = useStore();
  const [actionLoading, setActionLoading] = useState('');
  const [message, setMessage] = useState('');
  const [collateralForm, setCollateralForm] = useState({ type: 'vehicle', vin: '', condition: 'good', mileage: '' });
  const [docForm, setDocForm] = useState({ name: '', category: 'income' });
  const [decisionForm, setDecisionForm] = useState({ decision_type: 'manual_approve', approved_amount: '', approved_rate: '', approved_term: '', reason_codes: [], notes: '' });

  useEffect(() => { fetchApplication(id); }, [id]);

  const app = currentApplication;
  if (loading && !app) return <div className="text-center py-12 text-gray-500" role="status" aria-live="polite">Loading...</div>;
  if (!app) return <div className="text-center py-12 text-gray-500" role="alert">Application not found</div>;

  const doAction = async (action, payload = {}) => {
    setActionLoading(action);
    setMessage('');
    try {
      const res = await api.post(`/applications/${id}/${action}`, payload);
      setMessage(`Action "${action}" completed successfully`);
      fetchApplication(id);
      return res.data;
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setActionLoading('');
    }
  };

  const handleCollateral = async (e) => {
    e.preventDefault();
    setActionLoading('collateral');
    try {
      const payload = { ...collateralForm, mileage: parseInt(collateralForm.mileage) || 0 };
      await api.post(`/collateral/${id}`, payload);
      setMessage('Collateral saved successfully');
      fetchApplication(id);
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setActionLoading('');
    }
  };

  const handleDocUpload = async (e) => {
    e.preventDefault();
    setActionLoading('doc');
    try {
      await api.post(`/documents/${id}`, { name: docForm.name, category: docForm.category, file_type: 'application/pdf' });
      setMessage('Document uploaded successfully');
      setDocForm({ name: '', category: 'income' });
      fetchApplication(id);
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setActionLoading('');
    }
  };

  const handleManualDecision = async (e) => {
    e.preventDefault();
    setActionLoading('decision');
    try {
      const payload = {
        ...decisionForm,
        approved_amount: parseFloat(decisionForm.approved_amount) || undefined,
        approved_rate: parseFloat(decisionForm.approved_rate) || undefined,
        approved_term: parseInt(decisionForm.approved_term) || undefined,
        reason_codes: decisionForm.reason_codes.length ? decisionForm.reason_codes : ['MANUAL_REVIEW'],
      };
      await api.post(`/applications/${id}/manual-decision`, payload);
      setMessage('Decision recorded');
      fetchApplication(id);
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setActionLoading('');
    }
  };

  const clearCondition = async (condId) => {
    try {
      await api.put(`/conditions/clear/${condId}`);
      setMessage('Condition cleared');
      fetchApplication(id);
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const isStaff = ['loan_officer', 'underwriter', 'branch_manager', 'system_admin'].includes(user?.role);
  const isUnderwriter = ['underwriter', 'branch_manager', 'system_admin'].includes(user?.role);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`} role="alert" aria-live="polite">
          {message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{app.application_number}</h1>
              <StatusBadge status={app.status} />
            </div>
            <p className="text-gray-500 mt-1">{app.product_name} &bull; {app.purpose}</p>
            <p className="text-sm text-gray-400 mt-1">
              Borrower: {app.borrower_first_name} {app.borrower_last_name}
              {app.officer_first_name && ` | Officer: ${app.officer_first_name} ${app.officer_last_name}`}
              {app.underwriter_first_name && ` | UW: ${app.underwriter_first_name} ${app.underwriter_last_name}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">${parseFloat(app.approved_amount || app.requested_amount).toLocaleString()}</p>
            {app.interest_rate && <p className="text-sm text-gray-500">{app.interest_rate}% &bull; {app.term_months}mo</p>}
            {app.ltv_ratio && <p className="text-sm text-gray-500">LTV: {app.ltv_ratio}% | DTI: {app.dti_ratio}%</p>}
          </div>
        </div>
      </div>

      {/* Workflow Actions */}
      {isStaff && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Workflow Actions</h2>
          <div className="flex flex-wrap gap-2">
            {['submitted', 'pre_qualified'].includes(app.status) && (
              <button onClick={() => doAction('pre-qualify')} disabled={!!actionLoading}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-700 disabled:opacity-50 flex items-center"
                aria-busy={actionLoading === 'pre-qualify'}>
                <CreditCard className="w-4 h-4 mr-1" aria-hidden="true" /> Soft Credit Pull
              </button>
            )}
            {['submitted', 'pre_qualified'].includes(app.status) && (
              <button onClick={() => doAction('credit-pull')} disabled={!!actionLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center"
                aria-busy={actionLoading === 'credit-pull'}>
                <CreditCard className="w-4 h-4 mr-1" aria-hidden="true" /> Hard Credit Pull
              </button>
            )}
            {['submitted', 'pre_qualified', 'credit_pulled'].includes(app.status) && (
              <button onClick={() => doAction('identity-check')} disabled={!!actionLoading}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50 flex items-center"
                aria-busy={actionLoading === 'identity-check'}>
                <Shield className="w-4 h-4 mr-1" aria-hidden="true" /> Identity Check
              </button>
            )}
            {['credit_pulled', 'identity_verified'].includes(app.status) && (
              <button onClick={() => doAction('verify-income')} disabled={!!actionLoading}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center"
                aria-busy={actionLoading === 'verify-income'}>
                <DollarSign className="w-4 h-4 mr-1" aria-hidden="true" /> Verify Income
              </button>
            )}
            {['income_verified', 'credit_pulled', 'identity_verified'].includes(app.status) && (
              <button onClick={() => doAction('decision')} disabled={!!actionLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center"
                aria-busy={actionLoading === 'decision'}>
                <CheckCircle className="w-4 h-4 mr-1" aria-hidden="true" /> Run Decision Engine
              </button>
            )}
            {['approved', 'conditionally_approved'].includes(app.status) && (
              <button onClick={() => doAction('e-sign', { signature_data: 'mock_signature_base64', signer_name: `${app.borrower_first_name} ${app.borrower_last_name}` })} disabled={!!actionLoading}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 flex items-center"
                aria-busy={actionLoading === 'e-sign'}>
                <PenTool className="w-4 h-4 mr-1" aria-hidden="true" /> E-Sign
              </button>
            )}
            {app.status === 'e_signed' && (
              <button onClick={() => doAction('fund', { disbursement_method: 'ach' })} disabled={!!actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 flex items-center"
                aria-busy={actionLoading === 'fund'}>
                <DollarSign className="w-4 h-4 mr-1" aria-hidden="true" /> Authorize Funding
              </button>
            )}
            {app.status === 'funded' && (
              <button onClick={() => doAction('handoff')} disabled={!!actionLoading}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50 flex items-center"
                aria-busy={actionLoading === 'handoff'}>
                <Truck className="w-4 h-4 mr-1" aria-hidden="true" /> Handoff to Servicing
              </button>
            )}
          </div>
        </div>
      )}

      {/* Counter Offer Response (Borrower) */}
      {app.status === 'counter_offered' && user?.role === 'borrower' && (
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-6">
          <h2 className="text-lg font-semibold text-orange-800 mb-2">Counter Offer</h2>
          <p className="text-orange-700 mb-4">Amount: ${parseFloat(app.approved_amount).toLocaleString()} at {app.interest_rate}% for {app.term_months} months</p>
          <div className="flex gap-3">
            <button onClick={() => doAction('counter-offer-response', { accept: true })}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center">
              <CheckCircle className="w-4 h-4 mr-1" aria-hidden="true" /> Accept
            </button>
            <button onClick={() => doAction('counter-offer-response', { accept: false })}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center">
              <XCircle className="w-4 h-4 mr-1" aria-hidden="true" /> Reject
            </button>
          </div>
        </div>
      )}

      {/* E-Sign for Borrower */}
      {['approved', 'conditionally_approved'].includes(app.status) && user?.role === 'borrower' && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-6">
          <h2 className="text-lg font-semibold text-green-800 mb-2">Sign Loan Documents</h2>
          <p className="text-green-700 mb-4">Your loan has been approved! Sign to proceed with funding.</p>
          <button onClick={() => doAction('e-sign', { signature_data: 'borrower_esig_base64', signer_name: `${user.first_name} ${user.last_name}` })}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center">
            <PenTool className="w-4 h-4 mr-1" aria-hidden="true" /> Sign Documents
          </button>
        </div>
      )}

      {/* Adverse Action Notice */}
      {app.status === 'declined' && app.adverse_action_notice && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-6">
          <h2 className="text-lg font-semibold text-red-800 flex items-center mb-2"><AlertTriangle className="w-5 h-5 mr-2" aria-hidden="true" /> Adverse Action Notice</h2>
          <pre className="text-sm text-red-700 whitespace-pre-wrap font-mono">{app.adverse_action_notice}</pre>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collateral */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Collateral</h2>
          {app.collateral && app.collateral.length > 0 ? (
            app.collateral.map(c => (
              <div key={c.id} className="space-y-2 text-sm">
                <p><span className="font-medium">Type:</span> {c.type}</p>
                {c.vin && <p><span className="font-medium">VIN:</span> {c.vin}</p>}
                {c.year && <p><span className="font-medium">Vehicle:</span> {c.year} {c.make} {c.model} {c.trim}</p>}
                {c.condition && <p><span className="font-medium">Condition:</span> <span className="capitalize">{c.condition}</span></p>}
                {c.estimated_value && <p><span className="font-medium">Value:</span> ${parseFloat(c.estimated_value).toLocaleString()}</p>}
                {c.nada_value && <p><span className="font-medium">NADA:</span> ${parseFloat(c.nada_value).toLocaleString()} | <span className="font-medium">KBB:</span> ${parseFloat(c.kbb_value).toLocaleString()}</p>}
                {c.property_address && <p><span className="font-medium">Address:</span> {c.property_address}</p>}
              </div>
            ))
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-3">No collateral recorded yet.</p>
              {(isStaff || user?.role === 'borrower') && (
                <form onSubmit={handleCollateral} className="space-y-3" aria-label="Add collateral">
                  <label htmlFor="collateral-type" className="sr-only">Collateral type</label>
                  <select id="collateral-type" value={collateralForm.type} onChange={(e) => setCollateralForm({ ...collateralForm, type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" aria-label="Collateral type">
                    <option value="vehicle">Vehicle</option>
                    <option value="property">Property</option>
                    <option value="equipment">Equipment</option>
                  </select>
                  {collateralForm.type === 'vehicle' && (
                    <>
                      <label htmlFor="collateral-vin" className="sr-only">VIN</label>
                      <input id="collateral-vin" type="text" placeholder="VIN" value={collateralForm.vin} onChange={(e) => setCollateralForm({ ...collateralForm, vin: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm" maxLength={17} aria-label="Vehicle identification number" />
                      <label htmlFor="collateral-condition" className="sr-only">Condition</label>
                      <select id="collateral-condition" value={collateralForm.condition} onChange={(e) => setCollateralForm({ ...collateralForm, condition: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm" aria-label="Vehicle condition">
                        <option value="excellent">Excellent</option>
                        <option value="good">Good</option>
                        <option value="fair">Fair</option>
                        <option value="poor">Poor</option>
                      </select>
                      <label htmlFor="collateral-mileage" className="sr-only">Mileage</label>
                      <input id="collateral-mileage" type="number" placeholder="Mileage" value={collateralForm.mileage} onChange={(e) => setCollateralForm({ ...collateralForm, mileage: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm" aria-label="Vehicle mileage" />
                    </>
                  )}
                  <button type="submit" disabled={actionLoading === 'collateral'}
                    className="w-full py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                    Save Collateral
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Credit Reports */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Credit Reports</h2>
          {app.credit_reports && app.credit_reports.length > 0 ? (
            app.credit_reports.map(cr => (
              <div key={cr.id} className="mb-3 p-3 bg-gray-50 rounded-lg text-sm">
                <div className="flex justify-between">
                  <span className="font-medium capitalize">{cr.pull_type} Pull - {cr.bureau}</span>
                  <span className={`font-bold ${cr.score >= 700 ? 'text-green-600' : cr.score >= 620 ? 'text-yellow-600' : 'text-red-600'}`}>Score: {cr.score}</span>
                </div>
                {cr.tradelines && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">Tradelines: {JSON.parse(cr.tradelines).length}</p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No credit reports yet</p>
          )}
        </div>

        {/* Conditions */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Conditions</h2>
          {app.conditions && app.conditions.length > 0 ? (
            app.conditions.map(cond => (
              <div key={cond.id} className="mb-3 p-3 bg-gray-50 rounded-lg text-sm flex items-center justify-between">
                <div>
                  <p className="font-medium">{cond.name}</p>
                  <p className="text-gray-500 text-xs">{cond.category?.replace(/_/g, ' ')} &bull; <StatusBadge status={cond.status} /></p>
                </div>
                {cond.status === 'pending' && isStaff && (
                  <button onClick={() => clearCondition(cond.id)} className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                    aria-label={`Clear condition: ${cond.name}`}>
                    Clear
                  </button>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No conditions</p>
          )}
        </div>

        {/* Documents */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Documents</h2>
          {app.documents && app.documents.map(doc => (
            <div key={doc.id} className="mb-2 p-2 bg-gray-50 rounded text-sm flex items-center justify-between">
              <div>
                <p className="font-medium">{doc.name}</p>
                <p className="text-xs text-gray-500">{doc.category} &bull; <StatusBadge status={doc.status} /></p>
              </div>
            </div>
          ))}
          <form onSubmit={handleDocUpload} className="mt-3 space-y-2" aria-label="Upload document">
            <label htmlFor="doc-name" className="sr-only">Document name</label>
            <input id="doc-name" type="text" placeholder="Document name" value={docForm.name} onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" required aria-required="true" aria-label="Document name" />
            <label htmlFor="doc-category" className="sr-only">Document category</label>
            <select id="doc-category" value={docForm.category} onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" aria-label="Document category">
              <option value="income">Income</option>
              <option value="identity">Identity</option>
              <option value="collateral">Collateral</option>
              <option value="insurance">Insurance</option>
              <option value="agreement">Agreement</option>
            </select>
            <button type="submit" disabled={actionLoading === 'doc'}
              className="w-full py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center"
              aria-busy={actionLoading === 'doc'}>
              <Upload className="w-4 h-4 mr-1" aria-hidden="true" /> Upload Document
            </button>
          </form>
        </div>

        {/* Underwriter Decision Form */}
        {isUnderwriter && app.status === 'underwriting' && (
          <div className="bg-white rounded-xl shadow-sm border p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Manual Decision</h2>
            <form onSubmit={handleManualDecision} className="space-y-4" aria-label="Manual underwriting decision">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="decision-type" className="block text-sm font-medium text-gray-700 mb-1">Decision</label>
                  <select id="decision-type" value={decisionForm.decision_type} onChange={(e) => setDecisionForm({ ...decisionForm, decision_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg">
                    <option value="manual_approve">Approve</option>
                    <option value="manual_decline">Decline</option>
                    <option value="counter_offer">Counter Offer</option>
                    <option value="refer">Refer Back</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="decision-amount" className="block text-sm font-medium text-gray-700 mb-1">Approved Amount ($)</label>
                  <input id="decision-amount" type="number" value={decisionForm.approved_amount} onChange={(e) => setDecisionForm({ ...decisionForm, approved_amount: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label htmlFor="decision-rate" className="block text-sm font-medium text-gray-700 mb-1">Rate (%)</label>
                  <input id="decision-rate" type="number" step="0.01" value={decisionForm.approved_rate} onChange={(e) => setDecisionForm({ ...decisionForm, approved_rate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label htmlFor="decision-term" className="block text-sm font-medium text-gray-700 mb-1">Term (months)</label>
                  <input id="decision-term" type="number" value={decisionForm.approved_term} onChange={(e) => setDecisionForm({ ...decisionForm, approved_term: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div>
                <label htmlFor="decision-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea id="decision-notes" value={decisionForm.notes} onChange={(e) => setDecisionForm({ ...decisionForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" rows={2} />
              </div>
              <button type="submit" disabled={actionLoading === 'decision'}
                className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50">
                Submit Decision
              </button>
            </form>
          </div>
        )}

        {/* Decisions History */}
        {app.decisions && app.decisions.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Decision History</h2>
            {app.decisions.map(d => (
              <div key={d.id} className="mb-3 p-3 bg-gray-50 rounded-lg text-sm">
                <div className="flex justify-between">
                  <span className="font-medium capitalize">{d.decision_type.replace(/_/g, ' ')}</span>
                  <span className="text-gray-500">{new Date(d.created_at).toLocaleString()}</span>
                </div>
                {d.approved_amount && <p>Amount: ${parseFloat(d.approved_amount).toLocaleString()} at {d.approved_rate}%</p>}
                {d.decided_by_name && <p className="text-gray-500">By: {d.decided_by_name} {d.decided_by_last}</p>}
                {d.notes && <p className="text-gray-500 italic">{d.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
