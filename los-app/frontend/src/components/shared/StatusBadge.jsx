import React from 'react';

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  pre_qualified: 'bg-cyan-100 text-cyan-800',
  credit_pulled: 'bg-indigo-100 text-indigo-800',
  identity_verified: 'bg-teal-100 text-teal-800',
  income_verified: 'bg-emerald-100 text-emerald-800',
  underwriting: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  conditionally_approved: 'bg-lime-100 text-lime-800',
  counter_offered: 'bg-orange-100 text-orange-800',
  declined: 'bg-red-100 text-red-800',
  docs_sent: 'bg-purple-100 text-purple-800',
  e_signed: 'bg-violet-100 text-violet-800',
  funding_authorized: 'bg-sky-100 text-sky-800',
  funded: 'bg-green-200 text-green-900',
  servicing: 'bg-slate-100 text-slate-800',
  withdrawn: 'bg-gray-200 text-gray-600',
  // Condition statuses
  pending: 'bg-yellow-100 text-yellow-800',
  cleared: 'bg-green-100 text-green-800',
  waived: 'bg-blue-100 text-blue-800',
  reviewed: 'bg-indigo-100 text-indigo-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  uploaded: 'bg-gray-100 text-gray-800',
};

const statusLabels = {
  draft: 'Draft',
  submitted: 'Submitted',
  pre_qualified: 'Pre-Qualified',
  credit_pulled: 'Credit Pulled',
  identity_verified: 'ID Verified',
  income_verified: 'Income Verified',
  underwriting: 'Underwriting',
  approved: 'Approved',
  conditionally_approved: 'Cond. Approved',
  counter_offered: 'Counter Offered',
  declined: 'Declined',
  docs_sent: 'Docs Sent',
  e_signed: 'E-Signed',
  funding_authorized: 'Funding Auth.',
  funded: 'Funded',
  servicing: 'In Servicing',
  withdrawn: 'Withdrawn',
  pending: 'Pending',
  cleared: 'Cleared',
  waived: 'Waived',
  reviewed: 'Reviewed',
  accepted: 'Accepted',
  rejected: 'Rejected',
  uploaded: 'Uploaded',
};

export default function StatusBadge({ status }) {
  const color = statusColors[status] || 'bg-gray-100 text-gray-800';
  const label = statusLabels[status] || status?.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
