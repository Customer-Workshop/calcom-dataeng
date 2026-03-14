import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useStore from './store/useStore';
import Layout from './components/shared/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BorrowerDashboard from './pages/BorrowerDashboard';
import BorrowerApplication from './pages/BorrowerApplication';
import ApplicationDetail from './pages/ApplicationDetail';
import LoanOfficerDashboard from './pages/LoanOfficerDashboard';
import BranchManagerDashboard from './pages/BranchManagerDashboard';
import UnderwriterDashboard from './pages/UnderwriterDashboard';
import ComplianceDashboard from './pages/ComplianceDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ExecutiveDashboard from './pages/ExecutiveDashboard';

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user } = useStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to={getDefaultRoute(user?.role)} replace />;
  }
  return children;
}

function getDefaultRoute(role) {
  const routes = {
    borrower: '/borrower',
    loan_officer: '/officer',
    branch_manager: '/manager',
    underwriter: '/underwriter',
    compliance_officer: '/compliance',
    system_admin: '/admin',
    executive: '/executive',
  };
  return routes[role] || '/login';
}

function App() {
  const { isAuthenticated, user } = useStore();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to={getDefaultRoute(user?.role)} replace /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to={getDefaultRoute(user?.role)} replace /> : <RegisterPage />} />
      
      <Route path="/" element={
        <ProtectedRoute><Layout /></ProtectedRoute>
      }>
        {/* Borrower */}
        <Route path="borrower" element={<ProtectedRoute allowedRoles={['borrower']}><BorrowerDashboard /></ProtectedRoute>} />
        <Route path="borrower/apply" element={<ProtectedRoute allowedRoles={['borrower']}><BorrowerApplication /></ProtectedRoute>} />
        <Route path="application/:id" element={<ProtectedRoute><ApplicationDetail /></ProtectedRoute>} />
        
        {/* Loan Officer */}
        <Route path="officer" element={<ProtectedRoute allowedRoles={['loan_officer']}><LoanOfficerDashboard /></ProtectedRoute>} />
        
        {/* Branch Manager */}
        <Route path="manager" element={<ProtectedRoute allowedRoles={['branch_manager']}><BranchManagerDashboard /></ProtectedRoute>} />
        
        {/* Underwriter */}
        <Route path="underwriter" element={<ProtectedRoute allowedRoles={['underwriter']}><UnderwriterDashboard /></ProtectedRoute>} />
        
        {/* Compliance */}
        <Route path="compliance" element={<ProtectedRoute allowedRoles={['compliance_officer']}><ComplianceDashboard /></ProtectedRoute>} />
        
        {/* Admin */}
        <Route path="admin" element={<ProtectedRoute allowedRoles={['system_admin']}><AdminDashboard /></ProtectedRoute>} />
        
        {/* Executive */}
        <Route path="executive" element={<ProtectedRoute allowedRoles={['executive', 'system_admin']}><ExecutiveDashboard /></ProtectedRoute>} />
        
        <Route index element={<Navigate to={getDefaultRoute(user?.role)} replace />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
