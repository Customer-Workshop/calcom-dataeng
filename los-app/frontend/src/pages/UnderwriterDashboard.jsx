import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, RefreshCw, AlertTriangle } from 'lucide-react';
import useStore from '../store/useStore';
import StatusBadge from '../components/shared/StatusBadge';

export default function UnderwriterDashboard() {
  const { applications, fetchApplications, loading } = useStore();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('underwriting');

  useEffect(() => {
    fetchApplications({ status: statusFilter || undefined, limit: 50 });
  }, [statusFilter]);

  const uwStatuses = ['underwriting', 'approved', 'conditionally_approved', 'counter_offered', 'declined'];

  // Prioritize by requested amount (higher = more urgent) and creation date
  const sortedApps = [...applications].sort((a, b) => {
    if (a.status === 'underwriting' && b.status !== 'underwriting') return -1;
    if (b.status === 'underwriting' && a.status !== 'underwriting') return 1;
    return parseFloat(b.requested_amount) - parseFloat(a.requested_amount);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Underwriter Queue</h1>
        <button onClick={() => fetchApplications({ status: statusFilter || undefined, limit: 50 })}
          className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 flex items-center text-gray-600">
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${!statusFilter ? 'bg-primary-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
          All
        </button>
        {uwStatuses.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${statusFilter === s ? 'bg-primary-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Queue */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : sortedApps.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
            <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Queue is Empty</h3>
            <p className="text-gray-500 mt-1">No applications match the current filter.</p>
          </div>
        ) : sortedApps.map(app => (
          <div key={app.id} className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/application/${app.id}`)}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900">{app.application_number}</h3>
                  <StatusBadge status={app.status} />
                  {parseFloat(app.requested_amount) > 100000 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <AlertTriangle className="w-3 h-3 mr-1" /> High Value
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {app.borrower_first_name} {app.borrower_last_name} &bull; {app.product_name} &bull; {app.state}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  {app.credit_score && <span>Credit: {app.credit_score}</span>}
                  {app.ltv_ratio && <span>LTV: {app.ltv_ratio}%</span>}
                  {app.dti_ratio && <span>DTI: {app.dti_ratio}%</span>}
                  {app.officer_first_name && <span>LO: {app.officer_first_name} {app.officer_last_name}</span>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900">${parseFloat(app.requested_amount).toLocaleString()}</p>
                <p className="text-sm text-gray-500">{app.term_months}mo</p>
                <p className="text-xs text-gray-400">{new Date(app.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
