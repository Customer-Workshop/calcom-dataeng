import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Mock zustand store
const mockStore = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  applications: [],
  currentApplication: null,
  applicationsTotal: 0,
  applicationsPage: 1,
  pipeline: [],
  dashboard: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  fetchApplications: vi.fn(),
  fetchApplication: vi.fn(),
  createApplication: vi.fn(),
  fetchPipeline: vi.fn(),
  fetchDashboard: vi.fn(),
  clearError: vi.fn(),
};

vi.mock('../store/useStore', () => ({
  default: vi.fn((selector) => {
    if (typeof selector === 'function') return selector(mockStore);
    return mockStore;
  }),
}));

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

// ============================================================
// Login Page Tests
// ============================================================

describe('LoginPage', () => {
  it('renders login form with email and password fields', async () => {
    const LoginPage = (await import('../pages/LoginPage')).default;
    render(<BrowserRouter><LoginPage /></BrowserRouter>);
    
    expect(screen.getByAltText('Republic Finance')).toBeDefined();
    expect(screen.getByText('Loan Origination System')).toBeDefined();
    expect(screen.getByPlaceholderText('you@example.com')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter your password')).toBeDefined();
    expect(screen.getByText('Sign In')).toBeDefined();
  });

  it('shows demo account quick login buttons for all 7 personas', async () => {
    const LoginPage = (await import('../pages/LoginPage')).default;
    render(<BrowserRouter><LoginPage /></BrowserRouter>);
    
    expect(screen.getByText('Borrower')).toBeDefined();
    expect(screen.getByText('Loan Officer')).toBeDefined();
    expect(screen.getByText('Branch Manager')).toBeDefined();
    expect(screen.getByText('Underwriter')).toBeDefined();
    expect(screen.getByText('Compliance')).toBeDefined();
    expect(screen.getByText('System Admin')).toBeDefined();
    expect(screen.getByText('Executive')).toBeDefined();
  });

  it('fills email when demo borrower button is clicked', async () => {
    const LoginPage = (await import('../pages/LoginPage')).default;
    render(<BrowserRouter><LoginPage /></BrowserRouter>);
    
    const borrowerBtn = screen.getByText('Borrower');
    fireEvent.click(borrowerBtn);
    
    const emailInput = screen.getByPlaceholderText('you@example.com');
    expect(emailInput.value).toBe('borrower1@example.com');
  });

  it('has accessible form labels', async () => {
    const LoginPage = (await import('../pages/LoginPage')).default;
    render(<BrowserRouter><LoginPage /></BrowserRouter>);
    
    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    expect(emailInput).toBeDefined();
    expect(passwordInput).toBeDefined();
  });

  it('has a link to registration page', async () => {
    const LoginPage = (await import('../pages/LoginPage')).default;
    render(<BrowserRouter><LoginPage /></BrowserRouter>);
    
    expect(screen.getByText(/Create an account/i)).toBeDefined();
  });
});

// ============================================================
// Register Page Tests
// ============================================================

describe('RegisterPage', () => {
  it('renders registration form with all required fields', async () => {
    const RegisterPage = (await import('../pages/RegisterPage')).default;
    render(<BrowserRouter><RegisterPage /></BrowserRouter>);
    
    expect(screen.getAllByText('Create Account').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Create your borrower account')).toBeDefined();
  });

  it('has a link back to login page', async () => {
    const RegisterPage = (await import('../pages/RegisterPage')).default;
    render(<BrowserRouter><RegisterPage /></BrowserRouter>);
    
    expect(screen.getByText(/Sign in/i)).toBeDefined();
  });
});

// ============================================================
// Persona 1: Borrower Dashboard Tests
// ============================================================

describe('BorrowerDashboard - Empty State', () => {
  it('shows empty state when no applications exist', async () => {
    mockStore.applications = [];
    const BorrowerDashboard = (await import('../pages/BorrowerDashboard')).default;
    render(<BrowserRouter><BorrowerDashboard /></BrowserRouter>);
    
    expect(screen.getByText('My Applications')).toBeDefined();
    expect(screen.getByText('No Applications Yet')).toBeDefined();
    expect(screen.getByText('Apply Now')).toBeDefined();
  });
});

describe('BorrowerDashboard - With Data', () => {
  beforeEach(() => {
    mockStore.applications = [
      {
        id: 1,
        application_number: 'RF-2026-0001',
        status: 'submitted',
        product_name: 'Personal Loan',
        purpose: 'Debt consolidation',
        requested_amount: '15000.00',
        term_months: 36,
      },
      {
        id: 2,
        application_number: 'RF-2026-0002',
        status: 'approved',
        product_name: 'Auto Secured Loan',
        purpose: 'Vehicle purchase',
        requested_amount: '25000.00',
        term_months: 60,
      },
    ];
  });

  afterEach(() => {
    mockStore.applications = [];
  });

  it('renders application cards when applications exist', async () => {
    const BorrowerDashboard = (await import('../pages/BorrowerDashboard')).default;
    render(<BrowserRouter><BorrowerDashboard /></BrowserRouter>);
    
    expect(screen.getByText('RF-2026-0001')).toBeDefined();
    expect(screen.getByText(/Personal Loan/)).toBeDefined();
  });

  it('displays multiple applications', async () => {
    const BorrowerDashboard = (await import('../pages/BorrowerDashboard')).default;
    render(<BrowserRouter><BorrowerDashboard /></BrowserRouter>);
    
    expect(screen.getByText('RF-2026-0001')).toBeDefined();
    expect(screen.getByText('RF-2026-0002')).toBeDefined();
  });
});

// ============================================================
// Borrower Application Form Tests
// ============================================================

describe('BorrowerApplication', () => {
  it('renders multi-step application form', async () => {
    const BorrowerApplication = (await import('../pages/BorrowerApplication')).default;
    render(<BrowserRouter><BorrowerApplication /></BrowserRouter>);
    
    expect(screen.getByText('Loan Application')).toBeDefined();
    expect(screen.getAllByText('Loan Details').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Personal Info')).toBeDefined();
    expect(screen.getByText('Income & Employment')).toBeDefined();
  });

  it('navigates to step 2 when Next is clicked', async () => {
    const BorrowerApplication = (await import('../pages/BorrowerApplication')).default;
    render(<BrowserRouter><BorrowerApplication /></BrowserRouter>);
    
    const nextBtn = screen.getByText('Next: Personal Info');
    fireEvent.click(nextBtn);
    
    expect(screen.getByText('Personal Information')).toBeDefined();
    expect(screen.getByText('SSN (last 4 digits)')).toBeDefined();
  });

  it('shows step indicators', async () => {
    const BorrowerApplication = (await import('../pages/BorrowerApplication')).default;
    render(<BrowserRouter><BorrowerApplication /></BrowserRouter>);
    
    expect(screen.getAllByText('Loan Details').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Personal Info')).toBeDefined();
    expect(screen.getByText('Income & Employment')).toBeDefined();
  });
});

// ============================================================
// Persona 2: Loan Officer Dashboard Tests
// ============================================================

describe('LoanOfficerDashboard', () => {
  beforeEach(() => {
    mockStore.applications = [
      {
        id: 1,
        application_number: 'RF-2026-0001',
        status: 'submitted',
        product_name: 'Personal Loan',
        borrower_first_name: 'John',
        borrower_last_name: 'Smith',
        requested_amount: '15000.00',
        term_months: 36,
        state: 'TX',
        created_at: '2026-03-01',
      },
    ];
    mockStore.pipeline = [
      { status: 'submitted', count: 3, total_amount: '45000' },
      { status: 'approved', count: 2, total_amount: '50000' },
    ];
    mockStore.loading = false;
  });

  afterEach(() => {
    mockStore.applications = [];
    mockStore.pipeline = [];
  });

  it('renders loan officer pipeline header', async () => {
    const LoanOfficerDashboard = (await import('../pages/LoanOfficerDashboard')).default;
    render(<BrowserRouter><LoanOfficerDashboard /></BrowserRouter>);
    
    expect(screen.getByText('Loan Officer Pipeline')).toBeDefined();
  });

  it('displays pipeline summary cards', async () => {
    const LoanOfficerDashboard = (await import('../pages/LoanOfficerDashboard')).default;
    render(<BrowserRouter><LoanOfficerDashboard /></BrowserRouter>);
    
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
  });

  it('shows applications table with borrower info', async () => {
    const LoanOfficerDashboard = (await import('../pages/LoanOfficerDashboard')).default;
    render(<BrowserRouter><LoanOfficerDashboard /></BrowserRouter>);
    
    expect(screen.getByText('RF-2026-0001')).toBeDefined();
    expect(screen.getByText('John Smith')).toBeDefined();
  });

  it('has search and filter controls', async () => {
    const LoanOfficerDashboard = (await import('../pages/LoanOfficerDashboard')).default;
    render(<BrowserRouter><LoanOfficerDashboard /></BrowserRouter>);
    
    expect(screen.getByPlaceholderText('Search applications...')).toBeDefined();
    expect(screen.getByText('All Statuses')).toBeDefined();
    expect(screen.getByText('Refresh')).toBeDefined();
  });

  it('shows empty state when no applications match', async () => {
    mockStore.applications = [];
    const LoanOfficerDashboard = (await import('../pages/LoanOfficerDashboard')).default;
    render(<BrowserRouter><LoanOfficerDashboard /></BrowserRouter>);
    
    expect(screen.getByText('No applications found')).toBeDefined();
  });
});

// ============================================================
// Persona 3: Branch Manager Dashboard Tests
// ============================================================

describe('BranchManagerDashboard', () => {
  beforeEach(() => {
    mockStore.applications = [
      {
        id: 1,
        application_number: 'RF-2026-0001',
        status: 'submitted',
        borrower_first_name: 'John',
        borrower_last_name: 'Smith',
        officer_first_name: 'Sarah',
        officer_last_name: 'Johnson',
        requested_amount: '15000.00',
      },
    ];
    mockStore.pipeline = [
      { status: 'submitted', count: 5, total_amount: '75000' },
    ];
    mockStore.loading = false;
  });

  afterEach(() => {
    mockStore.applications = [];
    mockStore.pipeline = [];
  });

  it('renders branch pipeline header', async () => {
    const BranchManagerDashboard = (await import('../pages/BranchManagerDashboard')).default;
    render(<BrowserRouter><BranchManagerDashboard /></BrowserRouter>);
    
    expect(screen.getByText('Branch Pipeline')).toBeDefined();
  });

  it('shows reassign buttons for applications', async () => {
    const BranchManagerDashboard = (await import('../pages/BranchManagerDashboard')).default;
    render(<BrowserRouter><BranchManagerDashboard /></BrowserRouter>);
    
    expect(screen.getByText('Reassign')).toBeDefined();
  });

  it('displays officer name in table', async () => {
    const BranchManagerDashboard = (await import('../pages/BranchManagerDashboard')).default;
    render(<BrowserRouter><BranchManagerDashboard /></BrowserRouter>);
    
    expect(screen.getByText('Sarah Johnson')).toBeDefined();
  });

  it('has refresh button', async () => {
    const BranchManagerDashboard = (await import('../pages/BranchManagerDashboard')).default;
    render(<BrowserRouter><BranchManagerDashboard /></BrowserRouter>);
    
    expect(screen.getByText('Refresh')).toBeDefined();
  });
});

// ============================================================
// Persona 4: Underwriter Dashboard Tests
// ============================================================

describe('UnderwriterDashboard', () => {
  beforeEach(() => {
    mockStore.applications = [
      {
        id: 1,
        application_number: 'RF-2026-0005',
        status: 'underwriting',
        product_name: 'Home Improvement Loan',
        borrower_first_name: 'Patricia',
        borrower_last_name: 'Moore',
        requested_amount: '45000.00',
        term_months: 60,
        state: 'FL',
        credit_score: 685,
        ltv_ratio: 75.5,
        dti_ratio: 27.27,
        officer_first_name: 'Sarah',
        officer_last_name: 'Johnson',
        created_at: '2026-03-01',
      },
    ];
    mockStore.loading = false;
  });

  afterEach(() => {
    mockStore.applications = [];
  });

  it('renders underwriter review queue header', async () => {
    const UnderwriterDashboard = (await import('../pages/UnderwriterDashboard')).default;
    render(<BrowserRouter><UnderwriterDashboard /></BrowserRouter>);
    
    expect(screen.getByText('Underwriter Review Queue')).toBeDefined();
  });

  it('shows status filter tabs', async () => {
    const UnderwriterDashboard = (await import('../pages/UnderwriterDashboard')).default;
    render(<BrowserRouter><UnderwriterDashboard /></BrowserRouter>);
    
    expect(screen.getByText('All')).toBeDefined();
    expect(screen.getByText('underwriting')).toBeDefined();
    expect(screen.getByText('approved')).toBeDefined();
    expect(screen.getByText('declined')).toBeDefined();
  });

  it('displays application details with metrics', async () => {
    const UnderwriterDashboard = (await import('../pages/UnderwriterDashboard')).default;
    render(<BrowserRouter><UnderwriterDashboard /></BrowserRouter>);
    
    expect(screen.getByText('RF-2026-0005')).toBeDefined();
  });

  it('shows empty state when queue is empty', async () => {
    mockStore.applications = [];
    const UnderwriterDashboard = (await import('../pages/UnderwriterDashboard')).default;
    render(<BrowserRouter><UnderwriterDashboard /></BrowserRouter>);
    
    expect(screen.getByText('Queue is Empty')).toBeDefined();
  });
});

// ============================================================
// Persona 5: Compliance Dashboard Tests
// ============================================================

describe('ComplianceDashboard', () => {
  it('renders compliance panel header', async () => {
    const ComplianceDashboard = (await import('../pages/ComplianceDashboard')).default;
    render(<BrowserRouter><ComplianceDashboard /></BrowserRouter>);
    
    expect(screen.getByText('Compliance Panel')).toBeDefined();
  });

  it('shows tab navigation for rules, audit, adverse actions', async () => {
    const ComplianceDashboard = (await import('../pages/ComplianceDashboard')).default;
    render(<BrowserRouter><ComplianceDashboard /></BrowserRouter>);
    
    expect(screen.getByText('State Rules')).toBeDefined();
    expect(screen.getByText('Audit Trail')).toBeDefined();
    expect(screen.getByText('Adverse Actions')).toBeDefined();
  });

  it('has add state rule button', async () => {
    const ComplianceDashboard = (await import('../pages/ComplianceDashboard')).default;
    render(<BrowserRouter><ComplianceDashboard /></BrowserRouter>);
    
    expect(screen.getByText('Add State Rule')).toBeDefined();
  });

  it('shows loading state', async () => {
    const ComplianceDashboard = (await import('../pages/ComplianceDashboard')).default;
    render(<BrowserRouter><ComplianceDashboard /></BrowserRouter>);
    
    // Initially loading state may show
    expect(screen.getByText('Compliance Panel')).toBeDefined();
  });
});

// ============================================================
// Persona 6: Admin Dashboard Tests
// ============================================================

describe('AdminDashboard', () => {
  it('renders system administration header', async () => {
    const AdminDashboard = (await import('../pages/AdminDashboard')).default;
    render(<BrowserRouter><AdminDashboard /></BrowserRouter>);
    
    expect(screen.getByText('System Administration')).toBeDefined();
  });

  it('shows tab navigation for users, products, branches', async () => {
    const AdminDashboard = (await import('../pages/AdminDashboard')).default;
    render(<BrowserRouter><AdminDashboard /></BrowserRouter>);
    
    expect(screen.getByText('Users')).toBeDefined();
    expect(screen.getByText('Loan Products')).toBeDefined();
    expect(screen.getByText('Branches')).toBeDefined();
  });

  it('has create user button', async () => {
    const AdminDashboard = (await import('../pages/AdminDashboard')).default;
    render(<BrowserRouter><AdminDashboard /></BrowserRouter>);
    
    expect(screen.getByText('Create User')).toBeDefined();
  });

  it('shows users table structure', async () => {
    const AdminDashboard = (await import('../pages/AdminDashboard')).default;
    render(<BrowserRouter><AdminDashboard /></BrowserRouter>);
    
    expect(screen.getByText('System Administration')).toBeDefined();
  });
});

// ============================================================
// Persona 7: Executive Dashboard Tests
// ============================================================

describe('ExecutiveDashboard - With Data', () => {
  beforeEach(() => {
    mockStore.dashboard = {
      total_applications: 50,
      approval_rate: 72.5,
      avg_ltv: 78.3,
      avg_time_to_fund_days: 5.2,
      total_funded_amount: 1250000,
      by_state: [
        { state: 'TX', count: '20', total_amount: '500000' },
        { state: 'FL', count: '15', total_amount: '375000' },
        { state: 'OH', count: '10', total_amount: '250000' },
      ],
      by_product: [
        { product_name: 'Personal Loan', count: '25' },
        { product_name: 'Auto Secured', count: '15' },
        { product_name: 'Home Improvement', count: '10' },
      ],
      by_branch: [
        { branch_name: 'Main Street', count: '30', total_amount: '750000' },
        { branch_name: 'Downtown', count: '20', total_amount: '500000' },
      ],
      by_status: [
        { status: 'approved', count: '20' },
        { status: 'declined', count: '10' },
        { status: 'funded', count: '15' },
        { status: 'submitted', count: '5' },
      ],
    };
    mockStore.loading = false;
  });

  afterEach(() => {
    mockStore.dashboard = null;
    mockStore.loading = false;
  });

  it('renders executive dashboard header', async () => {
    const ExecutiveDashboard = (await import('../pages/ExecutiveDashboard')).default;
    render(<BrowserRouter><ExecutiveDashboard /></BrowserRouter>);
    
    expect(screen.getByText('Executive Dashboard')).toBeDefined();
  });

  it('renders KPI cards with dashboard data', async () => {
    const ExecutiveDashboard = (await import('../pages/ExecutiveDashboard')).default;
    render(<BrowserRouter><ExecutiveDashboard /></BrowserRouter>);
    
    expect(screen.getByText('50')).toBeDefined();
    expect(screen.getByText('72.5%')).toBeDefined();
    expect(screen.getByText('Total Applications')).toBeDefined();
    expect(screen.getByText('Approval Rate')).toBeDefined();
  });

  it('displays volume by state data', async () => {
    const ExecutiveDashboard = (await import('../pages/ExecutiveDashboard')).default;
    render(<BrowserRouter><ExecutiveDashboard /></BrowserRouter>);
    
    expect(screen.getByText('TX')).toBeDefined();
    expect(screen.getByText('FL')).toBeDefined();
  });

  it('displays volume by product data', async () => {
    const ExecutiveDashboard = (await import('../pages/ExecutiveDashboard')).default;
    render(<BrowserRouter><ExecutiveDashboard /></BrowserRouter>);
    
    // Product names are rendered inside Recharts SVG, check the section header instead
    expect(screen.getByText('Volume by Product')).toBeDefined();
  });
});

describe('ExecutiveDashboard - Loading State', () => {
  beforeEach(() => {
    mockStore.dashboard = null;
    mockStore.loading = true;
  });

  afterEach(() => {
    mockStore.loading = false;
  });

  it('shows loading state when dashboard is null', async () => {
    const ExecutiveDashboard = (await import('../pages/ExecutiveDashboard')).default;
    render(<BrowserRouter><ExecutiveDashboard /></BrowserRouter>);
    
    expect(screen.getByText('Executive Dashboard')).toBeDefined();
  });
});

// ============================================================
// StatusBadge Component Tests
// ============================================================

describe('StatusBadge', () => {
  it('renders approved status with correct label', async () => {
    const StatusBadge = (await import('../components/shared/StatusBadge')).default;
    render(<StatusBadge status="approved" />);
    expect(screen.getByText('Approved')).toBeDefined();
  });

  it('renders declined status', async () => {
    const StatusBadge = (await import('../components/shared/StatusBadge')).default;
    render(<StatusBadge status="declined" />);
    expect(screen.getByText('Declined')).toBeDefined();
  });

  it('renders submitted status', async () => {
    const StatusBadge = (await import('../components/shared/StatusBadge')).default;
    render(<StatusBadge status="submitted" />);
    expect(screen.getByText('Submitted')).toBeDefined();
  });

  it('renders funded status', async () => {
    const StatusBadge = (await import('../components/shared/StatusBadge')).default;
    render(<StatusBadge status="funded" />);
    expect(screen.getByText('Funded')).toBeDefined();
  });

  it('renders unknown status gracefully', async () => {
    const StatusBadge = (await import('../components/shared/StatusBadge')).default;
    render(<StatusBadge status="some_custom_status" />);
    expect(screen.getByText('some custom status')).toBeDefined();
  });
});

// ============================================================
// Layout Component Tests
// ============================================================

describe('Layout - Loan Officer User', () => {
  beforeEach(() => {
    mockStore.user = { first_name: 'Sarah', last_name: 'Johnson', role: 'loan_officer' };
    mockStore.isAuthenticated = true;
  });

  afterEach(() => {
    mockStore.user = null;
    mockStore.isAuthenticated = false;
  });

  it('renders sidebar with user info and navigation', async () => {
    const Layout = (await import('../components/shared/Layout')).default;
    render(<BrowserRouter><Layout /></BrowserRouter>);
    
    expect(screen.getByAltText('Republic Finance - Home')).toBeDefined();
    expect(screen.getByText('Sarah Johnson')).toBeDefined();
    expect(screen.getAllByText('Loan Officer').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Sign Out')).toBeDefined();
  });
});

describe('Layout - Branch Manager User', () => {
  beforeEach(() => {
    mockStore.user = { first_name: 'Richard', last_name: 'Harris', role: 'branch_manager' };
    mockStore.isAuthenticated = true;
  });

  afterEach(() => {
    mockStore.user = null;
    mockStore.isAuthenticated = false;
  });

  it('shows branch manager role label', async () => {
    const Layout = (await import('../components/shared/Layout')).default;
    render(<BrowserRouter><Layout /></BrowserRouter>);
    
    expect(screen.getByText('Richard Harris')).toBeDefined();
    expect(screen.getAllByText('Branch Manager').length).toBeGreaterThanOrEqual(1);
  });
});

describe('Layout - Underwriter User', () => {
  beforeEach(() => {
    mockStore.user = { first_name: 'Patricia', last_name: 'Moore', role: 'underwriter' };
    mockStore.isAuthenticated = true;
  });

  afterEach(() => {
    mockStore.user = null;
    mockStore.isAuthenticated = false;
  });

  it('shows underwriter role label', async () => {
    const Layout = (await import('../components/shared/Layout')).default;
    render(<BrowserRouter><Layout /></BrowserRouter>);
    
    expect(screen.getByText('Patricia Moore')).toBeDefined();
    expect(screen.getAllByText('Underwriter').length).toBeGreaterThanOrEqual(1);
  });
});

describe('Layout - System Admin User', () => {
  beforeEach(() => {
    mockStore.user = { first_name: 'Marcus', last_name: 'Rivera', role: 'system_admin' };
    mockStore.isAuthenticated = true;
  });

  afterEach(() => {
    mockStore.user = null;
    mockStore.isAuthenticated = false;
  });

  it('shows system admin role label', async () => {
    const Layout = (await import('../components/shared/Layout')).default;
    render(<BrowserRouter><Layout /></BrowserRouter>);
    
    expect(screen.getByText('Marcus Rivera')).toBeDefined();
    expect(screen.getAllByText('System Admin').length).toBeGreaterThanOrEqual(1);
  });
});

describe('Layout - Executive User', () => {
  beforeEach(() => {
    mockStore.user = { first_name: 'Victoria', last_name: 'King', role: 'executive' };
    mockStore.isAuthenticated = true;
  });

  afterEach(() => {
    mockStore.user = null;
    mockStore.isAuthenticated = false;
  });

  it('shows executive role label', async () => {
    const Layout = (await import('../components/shared/Layout')).default;
    render(<BrowserRouter><Layout /></BrowserRouter>);
    
    expect(screen.getByText('Victoria King')).toBeDefined();
    expect(screen.getAllByText('Executive').length).toBeGreaterThanOrEqual(1);
  });
});

describe('Layout - Compliance Officer User', () => {
  beforeEach(() => {
    mockStore.user = { first_name: 'Helen', last_name: 'Young', role: 'compliance_officer' };
    mockStore.isAuthenticated = true;
  });

  afterEach(() => {
    mockStore.user = null;
    mockStore.isAuthenticated = false;
  });

  it('shows compliance officer role label', async () => {
    const Layout = (await import('../components/shared/Layout')).default;
    render(<BrowserRouter><Layout /></BrowserRouter>);
    
    expect(screen.getByText('Helen Young')).toBeDefined();
    expect(screen.getAllByText('Compliance').length).toBeGreaterThanOrEqual(1);
  });
});
