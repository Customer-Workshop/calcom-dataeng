import React, { useEffect, useState } from 'react';
import { Shield, RefreshCw, Save, Plus, Search } from 'lucide-react';
import StatusBadge from '../components/shared/StatusBadge';
import api from '../utils/api';

export default function ComplianceDashboard() {
  const [tab, setTab] = useState('rules');
  const [stateRules, setStateRules] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [adverseActions, setAdverseActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editRule, setEditRule] = useState(null);
  const [newRule, setNewRule] = useState({ state: '', state_name: '', is_enabled: true, max_rate_cap: '', max_fee_percentage: '', min_loan_amount: '', max_loan_amount: '', disclosure_language: '', additional_rules: '' });
  const [showNewRule, setShowNewRule] = useState(false);
  const [auditFilter, setAuditFilter] = useState('');

  useEffect(() => {
    if (tab === 'rules') loadRules();
    else if (tab === 'audit') loadAudit();
    else if (tab === 'adverse') loadAdverse();
  }, [tab]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/state-rules');
      setStateRules(data);
    } catch (err) { setMessage(`Error: ${err.response?.data?.error || err.message}`); }
    finally { setLoading(false); }
  };

  const loadAudit = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/audit-logs', { params: { limit: 100, action: auditFilter || undefined } });
      setAuditLogs(data.data || []);
    } catch (err) { setMessage(`Error: ${err.response?.data?.error || err.message}`); }
    finally { setLoading(false); }
  };

  const loadAdverse = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/reporting/adverse-actions');
      setAdverseActions(data || []);
    } catch (err) { setMessage(`Error: ${err.response?.data?.error || err.message}`); }
    finally { setLoading(false); }
  };

  const saveRule = async (rule) => {
    try {
      const payload = {
        is_enabled: rule.is_enabled,
        max_rate_cap: parseFloat(rule.max_rate_cap) || null,
        max_fee_percentage: parseFloat(rule.max_fee_percentage) || null,
        min_loan_amount: parseFloat(rule.min_loan_amount) || null,
        max_loan_amount: parseFloat(rule.max_loan_amount) || null,
        disclosure_language: rule.disclosure_language,
        additional_rules: rule.additional_rules,
      };
      await api.put(`/admin/state-rules/${rule.id}`, payload);
      setMessage('Rule updated successfully');
      setEditRule(null);
      loadRules();
    } catch (err) { setMessage(`Error: ${err.response?.data?.error || err.message}`); }
  };

  const createRule = async () => {
    try {
      await api.post('/admin/state-rules', {
        ...newRule,
        max_rate_cap: parseFloat(newRule.max_rate_cap) || null,
        max_fee_percentage: parseFloat(newRule.max_fee_percentage) || null,
        min_loan_amount: parseFloat(newRule.min_loan_amount) || null,
        max_loan_amount: parseFloat(newRule.max_loan_amount) || null,
      });
      setMessage('Rule created');
      setShowNewRule(false);
      setNewRule({ state: '', state_name: '', is_enabled: true, max_rate_cap: '', max_fee_percentage: '', min_loan_amount: '', max_loan_amount: '', disclosure_language: '', additional_rules: '' });
      loadRules();
    } catch (err) { setMessage(`Error: ${err.response?.data?.error || err.message}`); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary-700 to-primary-600 rounded-xl p-5 text-white flex items-center gap-4 mb-2">
        <img src="/images/compliance.svg" alt="" role="presentation" className="h-20 rounded-lg hidden sm:block" />
        <div>
          <h1 className="text-xl font-bold">Compliance Panel</h1>
          <p className="text-primary-200 text-sm mt-1">State rules configuration, audit trails, and adverse action tracking.</p>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`} role="alert" aria-live="polite">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit" role="tablist" aria-label="Compliance sections">
        {[{ key: 'rules', label: 'State Rules' }, { key: 'audit', label: 'Audit Trail' }, { key: 'adverse', label: 'Adverse Actions' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} role="tab" aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`} id={`tab-${t.key}`}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white shadow text-primary-700' : 'text-gray-600 hover:text-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* State Rules */}
      {tab === 'rules' && (
        <div className="space-y-4" role="tabpanel" id="panel-rules" aria-labelledby="tab-rules">
          <button onClick={() => setShowNewRule(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 flex items-center">
            <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> Add State Rule
          </button>

          {showNewRule && (
            <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
              <h3 className="font-semibold">New State Rule</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="new-state-code" className="sr-only">State Code</label>
                  <input id="new-state-code" type="text" placeholder="State Code (e.g., CA)" value={newRule.state} onChange={(e) => setNewRule({ ...newRule, state: e.target.value })}
                    className="px-3 py-2 border rounded-lg text-sm" maxLength={2} aria-label="State code" />
                </div>
                <div>
                  <label htmlFor="new-state-name" className="sr-only">State Name</label>
                  <input id="new-state-name" type="text" placeholder="State Name" value={newRule.state_name} onChange={(e) => setNewRule({ ...newRule, state_name: e.target.value })}
                    className="px-3 py-2 border rounded-lg text-sm" aria-label="State name" />
                </div>
                <div>
                  <label htmlFor="new-max-rate" className="sr-only">Max Rate %</label>
                  <input id="new-max-rate" type="number" step="0.01" placeholder="Max Rate %" value={newRule.max_rate_cap} onChange={(e) => setNewRule({ ...newRule, max_rate_cap: e.target.value })}
                    className="px-3 py-2 border rounded-lg text-sm" aria-label="Maximum interest rate percentage" />
                </div>
                <div>
                  <label htmlFor="new-max-fee" className="sr-only">Max Fee %</label>
                  <input id="new-max-fee" type="number" step="0.01" placeholder="Max Fee %" value={newRule.max_fee_percentage} onChange={(e) => setNewRule({ ...newRule, max_fee_percentage: e.target.value })}
                    className="px-3 py-2 border rounded-lg text-sm" aria-label="Maximum fee percentage" />
                </div>
                <div>
                  <label htmlFor="new-min-loan" className="sr-only">Min Loan Amount</label>
                  <input id="new-min-loan" type="number" placeholder="Min Loan Amount" value={newRule.min_loan_amount} onChange={(e) => setNewRule({ ...newRule, min_loan_amount: e.target.value })}
                    className="px-3 py-2 border rounded-lg text-sm" aria-label="Minimum loan amount" />
                </div>
                <div>
                  <label htmlFor="new-max-loan" className="sr-only">Max Loan Amount</label>
                  <input id="new-max-loan" type="number" placeholder="Max Loan Amount" value={newRule.max_loan_amount} onChange={(e) => setNewRule({ ...newRule, max_loan_amount: e.target.value })}
                    className="px-3 py-2 border rounded-lg text-sm" aria-label="Maximum loan amount" />
                </div>
              </div>
              <label htmlFor="new-disclosures" className="sr-only">Required disclosures</label>
              <textarea id="new-disclosures" placeholder="Required disclosures" value={newRule.disclosure_language} onChange={(e) => setNewRule({ ...newRule, disclosure_language: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} aria-label="Required disclosures" />
              <div className="flex gap-3">
                <button onClick={() => setShowNewRule(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button onClick={createRule} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">Create</button>
              </div>
            </div>
          )}

          {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : (
            <div className="grid gap-4">
              {stateRules.map(rule => (
                <div key={rule.id} className="bg-white rounded-xl shadow-sm border p-5">
                  {editRule === rule.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor={`edit-max-rate-${rule.id}`} className="text-xs text-gray-500">Max Rate %</label>
                            <input id={`edit-max-rate-${rule.id}`} type="number" step="0.01" value={rule.max_rate_cap || ''} onChange={(e) => setStateRules(prev => prev.map(r => r.id === rule.id ? { ...r, max_rate_cap: e.target.value } : r))}
                              className="w-full px-3 py-2 border rounded-lg text-sm" />
                          </div>
                          <div>
                            <label htmlFor={`edit-max-fee-${rule.id}`} className="text-xs text-gray-500">Max Fee %</label>
                            <input id={`edit-max-fee-${rule.id}`} type="number" step="0.01" value={rule.max_fee_percentage || ''} onChange={(e) => setStateRules(prev => prev.map(r => r.id === rule.id ? { ...r, max_fee_percentage: e.target.value } : r))}
                              className="w-full px-3 py-2 border rounded-lg text-sm" />
                          </div>
                          <div>
                            <label htmlFor={`edit-min-loan-${rule.id}`} className="text-xs text-gray-500">Min Loan $</label>
                            <input id={`edit-min-loan-${rule.id}`} type="number" value={rule.min_loan_amount || ''} onChange={(e) => setStateRules(prev => prev.map(r => r.id === rule.id ? { ...r, min_loan_amount: e.target.value } : r))}
                              className="w-full px-3 py-2 border rounded-lg text-sm" />
                          </div>
                          <div>
                            <label htmlFor={`edit-max-loan-${rule.id}`} className="text-xs text-gray-500">Max Loan $</label>
                            <input id={`edit-max-loan-${rule.id}`} type="number" value={rule.max_loan_amount || ''} onChange={(e) => setStateRules(prev => prev.map(r => r.id === rule.id ? { ...r, max_loan_amount: e.target.value } : r))}
                              className="w-full px-3 py-2 border rounded-lg text-sm" />
                          </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label htmlFor={`edit-enabled-${rule.id}`} className="text-sm">Enabled:</label>
                        <input id={`edit-enabled-${rule.id}`} type="checkbox" checked={rule.is_enabled} onChange={(e) => setStateRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_enabled: e.target.checked } : r))} />
                      </div>
                      <label htmlFor={`edit-disclosures-${rule.id}`} className="sr-only">Required disclosures</label>
                      <textarea id={`edit-disclosures-${rule.id}`} value={rule.disclosure_language || ''} onChange={(e) => setStateRules(prev => prev.map(r => r.id === rule.id ? { ...r, disclosure_language: e.target.value } : r))}
                        className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Required disclosures" />
                      <div className="flex gap-2">
                        <button onClick={() => setEditRule(null)} className="px-3 py-1.5 border rounded text-sm">Cancel</button>
                        <button onClick={() => saveRule(rule)} className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm flex items-center">
                          <Save className="w-3 h-3 mr-1" aria-hidden="true" /> Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{rule.state_name} ({rule.state})</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${rule.is_enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {rule.is_enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Max Rate: {rule.max_rate_cap}% &bull; Max Fee: {rule.max_fee_percentage}% &bull;
                          Loan: ${parseFloat(rule.min_loan_amount || 0).toLocaleString()} - ${parseFloat(rule.max_loan_amount || 0).toLocaleString()}
                        </p>
                      </div>
                      <button onClick={() => setEditRule(rule.id)} className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50" aria-label={`Edit ${rule.state_name} rules`}>Edit</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audit Trail */}
      {tab === 'audit' && (
        <div className="space-y-4" role="tabpanel" id="panel-audit" aria-labelledby="tab-audit">
          <div className="flex gap-3" role="search" aria-label="Filter audit logs">
            <label htmlFor="audit-filter" className="sr-only">Filter by action</label>
            <input id="audit-filter" type="text" placeholder="Filter by action..." value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm flex-1" aria-label="Filter audit logs by action" />
            <button onClick={loadAudit} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm flex items-center">
              <Search className="w-4 h-4 mr-1" aria-hidden="true" /> Search
            </button>
          </div>
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-sm" aria-label="Audit trail logs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-gray-500">Timestamp</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-gray-500">Action</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-gray-500">Entity</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
                ) : auditLogs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No audit logs found</td></tr>
                ) : auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">{log.user_email || 'System'}</td>
                    <td className="px-4 py-3 font-medium">{log.action}</td>
                    <td className="px-4 py-3">{log.entity_type} #{log.entity_id}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{log.details ? JSON.stringify(log.details).substring(0, 80) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adverse Actions */}
      {tab === 'adverse' && (
        <div className="space-y-4" role="tabpanel" id="panel-adverse" aria-labelledby="tab-adverse">
          {loading ? <div className="text-center py-8 text-gray-500" role="status">Loading...</div> : adverseActions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
              <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" aria-hidden="true" />
              <p className="text-gray-500">No adverse actions recorded</p>
            </div>
          ) : adverseActions.map(aa => (
            <div key={aa.id} className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{aa.application_number}</h3>
                  <p className="text-sm text-gray-500">{aa.borrower_first_name} {aa.borrower_last_name} &bull; {aa.state}</p>
                </div>
                <StatusBadge status="declined" />
              </div>
              {aa.decision_reasons && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {JSON.parse(aa.decision_reasons).map((code, i) => (
                    <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs">{code}</span>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">{aa.decision_at ? new Date(aa.decision_at).toLocaleString() : 'N/A'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
