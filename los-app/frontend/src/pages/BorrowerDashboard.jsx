import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, Clock, CheckCircle, XCircle, Upload } from 'lucide-react';
import useStore from '../store/useStore';
import StatusBadge from '../components/shared/StatusBadge';
import api from '../utils/api';

export default function BorrowerDashboard() {
  const { applications, fetchApplications, loading } = useStore();
  const navigate = useNavigate();

  useEffect(() => { fetchApplications(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
        <Link to="/borrower/apply" className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          <Plus className="w-4 h-4 mr-2" /> New Application
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : applications.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No Applications Yet</h3>
          <p className="text-gray-500 mt-1">Start your loan journey by creating a new application.</p>
          <Link to="/borrower/apply" className="inline-flex items-center mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <Plus className="w-4 h-4 mr-2" /> Apply Now
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {applications.map((app) => (
            <div key={app.id} className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/application/${app.id}`)}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{app.application_number}</h3>
                    <StatusBadge status={app.status} />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{app.product_name} &bull; {app.purpose}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">${parseFloat(app.requested_amount).toLocaleString()}</p>
                  <p className="text-sm text-gray-500">{app.term_months} months</p>
                </div>
              </div>
              {app.status === 'counter_offered' && (
                <div className="mt-3 p-3 bg-orange-50 rounded-lg text-sm text-orange-700">
                  Counter offer: ${parseFloat(app.approved_amount).toLocaleString()} at {app.interest_rate}% - Review and respond
                </div>
              )}
              {app.status === 'approved' && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg text-sm text-green-700">
                  Approved for ${parseFloat(app.approved_amount).toLocaleString()} at {app.interest_rate}% - Ready for e-signature
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
