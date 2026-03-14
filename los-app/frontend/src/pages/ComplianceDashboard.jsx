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
  const [newRule, setNewRule] = useState({ state_code: '', state_name: '', is_enabled: true, max_interest_rate: '', max_fee_percentage: '', min_loan_amount: '', max_loan_amount: '', required_disclosures: '', special_provisions: '' });
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
      setAdverseActions(data.adverse_actions || []);
    } catch (err) { setMessage(`Error: ${err.response?.data?.error || err.message}`); }
    finally { setLoading(false); }
  };

  const saveRule = async (rule) => {
    try {
      const payload = {
        is_enabled: rule.is_enabled,
        max_interest_rate: parseFloat(rule.max_interest_rate) || null,
        max_fee_percentage: parseFloat(rule.max_fee_percentage) || null,
        min_loan_amount: parseFloat(rule.min_loan_amount) || null,
        max_loan_amount: parseFloat(rule.max_loan_amount) || null,
        required_disclosures: rule.required_disclosures,
        special_provisions: rule.special_provisions,
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
        max_interest_rate: parseFloat(newRule.max_interest_rate) || null,
        max_fee_percentage: parseFloat(newRule.max_fee_percentage) || null,
        min_loan_amount: parseFloat(newRule.min_loan_amount) || null,
        max_loan_amount: parseFloat(newRule.max_loan_amount) || null,
      });
      setMessage('Rule created');
      setShowNewRule(false);
      setNewRule({ state_code: '', state_name: '', is_enabled: true, max_interest_rate: '', max_fee_percentage: '', min_loan_amount: '', max_loan_amount: '', required_disclosures: '', special_provisions: '' });
      loadRules();
    } catch (err) { setMessage(`Error: ${err.response?.data?.error || err.message}`); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Compliance Panel</h1>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[{ key: 'rules', label: 'State Rules' }, { key: 'audit', label: 'Audit Trail' }, { key: 'adverse', label: 'Adverse Actions' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white shadow text-primary-700' : 'text-gray-600 hover:text-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* State Rules */}
      {tab === 'rules' && (
        <div className="space-y-4">
          <button onClick={() => setShowNewRule(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 flex items-center">
            <Plus className="w-4 h-4 mr-1" /> Add State Rule
          </button>

          {showNewRule && (
            <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
              <h3 className="font-semibold">New State Rule</h3>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="State Code (e.g., CA)" value={newRule.state_code} onChange={(e) => setNewRule({ ...newRule, state_code: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm" maxLength={2} />
                <input type="text" placeholder="State Name" value={newRule.state_name} onChange={(e) => setNewRule({ ...newRule, state_name: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm" />
                <input type="number" step="0.01" placeholder="Max Rate %" value={newRule.max_interest_rate} onChange={(e) => setNewRule({ ...newRule, max_interest_rate: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm" />
                <input type="number" step="0.01" placeholder="Max Fee %" value={newRule.max_fee_percentage} onChange={(e) => setNewRule({ ...newRule, max_fee_percentage: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm" />
                <input type="number" placeholder="Min Loan Amount" value={newRule.min_loan_amount} onChange={(e) => setNewRule({ ...newRule, min_loan_amount: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm" />
                <input type="number" placeholder="Max Loan Amount" value={newRule.max_loan_amount} onChange={(e) => setNewRule({ ...newRule, max_loan_amount: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm" />
              </div>
              <textarea placeholder="Required disclosures" value={newRule.required_disclosures} onChange={(e) => setNewRule({ ...newRule, required_disclosures: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
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
                          <label className="text-xs text-gray-500">Max Rate %</label>
                          <input type="number" step="0.01" value={rule.max_interest_rate || ''} onChange={(e) => setStateRules(prev => prev.map(r => r.id === rule.id ? { ...r, max_interest_rate: e.target.value } : r))}
                            className="w-full px-3 py-2 border rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Max Fee %</label>
                          <input type="number" step="0.01" value={rule.max_fee_percentage || ''} onChange={(e) => setStateRules(prev => prev.map(r => r.id === rule.id ? { ...r, max_fee_percentage: e.target.value } : r))}
                            className="w-full px-3 py-2 border rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Min Loan $</label>
                          <input type="number" value={rule.min_loan_amount || ''} onChange={(e) => setStateRules(prev => prev.map(r => r.id === rule.id ? { ...r, min_loan_amount: e.target.value } : r))}
                            className="w-full px-3 py-2 border rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Max Loan $</label>
                          <input type="number" value={rule.max_loan_amount || ''} onChange={(e) => setStateRules(prev => prev.map(r => r.id === rule.id ? { ...r, max_loan_amount: e.target.value } : r))}
                            className="w-full px-3 py-2 border rounded-lg text-sm" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm">Enabled:</label>
                        <input type="checkbox" checked={rule.is_enabled} onChange={(e) => setStateRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_enabled: e.target.checked } : r))} />
                      </div>
                      <textarea value={rule.required_disclosures || ''} onChange={(e) => setStateRules(prev => prev.map(r => r.id === rule.id ? { ...r, required_disclosures: e.target.value } : r))}
                        className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Required disclosures" />
                      <div className="flex gap-2">
                        <button onClick={() => setEditRule(null)} className="px-3 py-1.5 border rounded text-sm">Cancel</button>
                        <button onClick={() => saveRule(rule)} className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm flex items-center">
                          <Save className="w-3 h-3 mr-1" /> Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{rule.state_name} ({rule.state_code})</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${rule.is_enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {rule.is_enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Max Rate: {rule.max_interest_rate}% &bull; Max Fee: {rule.max_fee_percentage}% &bull;
                          Loan: ${parseFloat(rule.min_loan_amount || 0).toLocaleString()} - ${parseFloat(rule.max_loan_amount || 0).toLocaleString()}
                        </p>
                      </div>
                      <button onClick={() => setEditRule(rule.id)} className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50">Edit</button>
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
        <div className="space-y-4">
          <div className="flex gap-3">
            <input type="text" placeholder="Filter by action..." value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm flex-1" />
            <button onClick={loadAudit} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm flex items-center">
              <Search className="w-4 h-4 mr-1" /> Search
            </button>
          </div>
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Timestamp</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Entity</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Details</th>
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
        <div className="space-y-4">
          {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : adverseActions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
              <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
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
              {aa.reason_codes && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {JSON.parse(aa.reason_codes).map((code, i) => (
                    <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs">{code}</span>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">{new Date(aa.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
