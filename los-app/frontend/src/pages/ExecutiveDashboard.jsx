import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, DollarSign, Clock, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import useStore from '../store/useStore';

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

export default function ExecutiveDashboard() {
  const { dashboard, fetchDashboard, loading } = useStore();
  const [dateRange, setDateRange] = useState('30');

  useEffect(() => {
    fetchDashboard({ days: dateRange });
  }, [dateRange]);

  const kpis = dashboard ? [
    { label: 'Total Applications', value: dashboard.total_applications || 0, icon: BarChart3, color: 'text-blue-600 bg-blue-50' },
    { label: 'Approval Rate', value: `${(dashboard.approval_rate || 0).toFixed(1)}%`, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
    { label: 'Avg LTV', value: `${(dashboard.avg_ltv || 0).toFixed(1)}%`, icon: DollarSign, color: 'text-purple-600 bg-purple-50' },
    { label: 'Avg Time to Fund', value: `${(dashboard.avg_time_to_fund_days || 0).toFixed(1)}d`, icon: Clock, color: 'text-orange-600 bg-orange-50' },
    { label: 'Total Funded', value: `$${((dashboard.total_funded_amount || 0) / 1000).toFixed(0)}k`, icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Decline Rate', value: `${(dashboard.decline_rate || 0).toFixed(1)}%`, icon: TrendingUp, color: 'text-red-600 bg-red-50' },
  ] : [];

  const volumeByState = dashboard?.volume_by_state?.map(s => ({
    name: s.state,
    applications: parseInt(s.count),
    amount: parseFloat(s.total_amount) / 1000,
  })) || [];

  const volumeByProduct = dashboard?.volume_by_product?.map(p => ({
    name: p.product_name || 'Unknown',
    value: parseInt(p.count),
  })) || [];

  const volumeByBranch = dashboard?.volume_by_branch?.map(b => ({
    name: b.branch_name || 'Unassigned',
    applications: parseInt(b.count),
    amount: parseFloat(b.total_amount) / 1000,
  })) || [];

  const statusBreakdown = dashboard?.status_breakdown?.map(s => ({
    name: s.status?.replace(/_/g, ' ') || 'Unknown',
    value: parseInt(s.count),
  })) || [];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary-700 to-primary-600 rounded-xl p-5 text-white flex items-center gap-4 mb-2">
        <img src="/images/dashboard-kpi.svg" alt="" className="h-20 rounded-lg hidden sm:block" />
        <div>
          <h1 className="text-xl font-bold">Executive Dashboard</h1>
          <p className="text-primary-200 text-sm mt-1">Key performance indicators, volume analytics, and portfolio metrics.</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          <button onClick={() => fetchDashboard({ days: dateRange })}
            className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 flex items-center text-gray-600">
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading dashboard data...</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-xl shadow-sm border p-4">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 ${kpi.color}`}>
                  <kpi.icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Volume by State */}
            {volumeByState.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold mb-4">Volume by State</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={volumeByState}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="applications" fill="#3b82f6" name="Applications" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Volume by Product */}
            {volumeByProduct.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold mb-4">Volume by Product</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={volumeByProduct} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                      {volumeByProduct.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Volume by Branch */}
            {volumeByBranch.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold mb-4">Volume by Branch</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={volumeByBranch} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} />
                    <Tooltip />
                    <Bar dataKey="applications" fill="#22c55e" name="Applications" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Status Breakdown */}
            {statusBreakdown.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold mb-4">Application Status Breakdown</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={statusBreakdown} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                      {statusBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
