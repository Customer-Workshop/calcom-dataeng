import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, Filter, RefreshCw } from 'lucide-react';
import useStore from '../store/useStore';
import StatusBadge from '../components/shared/StatusBadge';
import api from '../utils/api';

export default function LoanOfficerDashboard() {
  const { applications, applicationsTotal, fetchApplications, fetchPipeline, pipeline, loading } = useStore();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchApplications({ status: statusFilter || undefined, page, limit: 20 });
    fetchPipeline();
  }, [statusFilter, page]);

  const statuses = ['submitted', 'pre_qualified', 'credit_pulled', 'identity_verified', 'income_verified',
    'underwriting', 'approved', 'conditionally_approved', 'counter_offered', 'declined',
    'docs_sent', 'e_signed', 'funding_authorized', 'funded', 'servicing'];

  const filteredApps = search
    ? applications.filter(a => 
        a.application_number?.toLowerCase().includes(search.toLowerCase()) ||
        a.borrower_first_name?.toLowerCase().includes(search.toLowerCase()) ||
        a.borrower_last_name?.toLowerCase().includes(search.toLowerCase()))
    : applications;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-primary-700 to-accent-500 rounded-xl p-5 text-white flex items-center gap-4">
        <img src="/images/loan-pipeline.svg" alt="" className="h-20 rounded-lg hidden sm:block" />
        <div>
          <h1 className="text-xl font-bold">Loan Officer Pipeline</h1>
          <p className="text-primary-200 text-sm mt-1">Manage applications, run credit checks, and process loan decisions.</p>
        </div>
      </div>

      {/* Pipeline Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {pipeline.map(p => (
          <div key={p.status} className="bg-white rounded-lg shadow-sm border p-3 cursor-pointer hover:shadow-md"
            onClick={() => setStatusFilter(p.status)}>
            <p className="text-xs text-gray-500 capitalize">{p.status.replace(/_/g, ' ')}</p>
            <p className="text-2xl font-bold text-gray-900">{p.count}</p>
            <p className="text-xs text-gray-400">${(parseFloat(p.total_amount) / 1000).toFixed(0)}k</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search applications..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <button onClick={() => { fetchApplications({ status: statusFilter || undefined, page }); fetchPipeline(); }}
          className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 flex items-center text-gray-600">
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </button>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Application</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Borrower</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">State</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : filteredApps.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No applications found</td></tr>
            ) : filteredApps.map(app => (
              <tr key={app.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/application/${app.id}`)}>
                <td className="px-4 py-3 font-medium text-primary-600">{app.application_number}</td>
                <td className="px-4 py-3">{app.borrower_first_name} {app.borrower_last_name}</td>
                <td className="px-4 py-3">{app.product_name}</td>
                <td className="px-4 py-3 text-right font-medium">${parseFloat(app.requested_amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-center"><StatusBadge status={app.status} /></td>
                <td className="px-4 py-3">{app.state}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(app.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {applicationsTotal > 20 && (
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">Showing {filteredApps.length} of {applicationsTotal}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={filteredApps.length < 20}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
