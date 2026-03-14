import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, RefreshCw, ArrowRightLeft } from 'lucide-react';
import useStore from '../store/useStore';
import StatusBadge from '../components/shared/StatusBadge';
import api from '../utils/api';

export default function BranchManagerDashboard() {
  const { applications, applicationsTotal, fetchApplications, fetchPipeline, pipeline, loading } = useStore();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [officers, setOfficers] = useState([]);
  const [reassignModal, setReassignModal] = useState(null);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchApplications({ status: statusFilter || undefined, page, limit: 20 });
    fetchPipeline();
    api.get('/admin/users', { params: { limit: 100 } }).then(res => {
      setOfficers(res.data.data?.filter(u => u.role_name === 'loan_officer') || []);
    }).catch(() => {});
  }, [statusFilter, page]);

  const handleReassign = async () => {
    if (!selectedOfficer || !reassignModal) return;
    try {
      await api.post(`/applications/${reassignModal}/reassign`, { loan_officer_id: parseInt(selectedOfficer) });
      setMessage('Loan reassigned successfully');
      setReassignModal(null);
      fetchApplications({ status: statusFilter || undefined, page, limit: 20 });
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary-700 to-accent-500 rounded-xl p-5 text-white flex items-center gap-4 mb-2">
        <img src="/images/loan-pipeline.svg" alt="" className="h-20 rounded-lg hidden sm:block" />
        <div>
          <h1 className="text-xl font-bold">Branch Pipeline</h1>
          <p className="text-primary-200 text-sm mt-1">Team pipeline overview, approval authority, and loan reassignment.</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => { fetchApplications({ status: statusFilter || undefined, page }); fetchPipeline(); }}
          className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 flex items-center text-gray-600">
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Pipeline Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {pipeline.map(p => (
          <div key={p.status} className="bg-white rounded-lg shadow-sm border p-3 cursor-pointer hover:shadow-md"
            onClick={() => setStatusFilter(p.status)}>
            <p className="text-xs text-gray-500 capitalize">{p.status.replace(/_/g, ' ')}</p>
            <p className="text-2xl font-bold text-gray-900">{p.count}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        className="px-3 py-2 border rounded-lg text-sm">
        <option value="">All Statuses</option>
        {['submitted', 'underwriting', 'approved', 'conditionally_approved', 'declined', 'funded'].map(s =>
          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
        )}
      </select>

      {/* Applications Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Application</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Borrower</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Officer</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : applications.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No applications found</td></tr>
            ) : applications.map(app => (
              <tr key={app.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-primary-600 cursor-pointer" onClick={() => navigate(`/application/${app.id}`)}>{app.application_number}</td>
                <td className="px-4 py-3">{app.borrower_first_name} {app.borrower_last_name}</td>
                <td className="px-4 py-3">{app.officer_first_name} {app.officer_last_name}</td>
                <td className="px-4 py-3 text-right font-medium">${parseFloat(app.requested_amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-center"><StatusBadge status={app.status} /></td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => { setReassignModal(app.id); setSelectedOfficer(''); }}
                    className="px-2 py-1 text-xs border rounded hover:bg-gray-50 flex items-center mx-auto">
                    <ArrowRightLeft className="w-3 h-3 mr-1" /> Reassign
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reassign Modal */}
      {reassignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setReassignModal(null)}>
          <div className="bg-white rounded-xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Reassign Loan Officer</h3>
            <select value={selectedOfficer} onChange={(e) => setSelectedOfficer(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg mb-4">
              <option value="">Select officer</option>
              {officers.map(o => <option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setReassignModal(null)} className="flex-1 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleReassign} disabled={!selectedOfficer}
                className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm disabled:opacity-50">Reassign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
