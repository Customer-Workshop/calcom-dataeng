import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

// Test 1: Login page renders correctly
describe('LoginPage', () => {
  it('renders login form with email and password fields', async () => {
    const LoginPage = (await import('../pages/LoginPage')).default;
    render(<BrowserRouter><LoginPage /></BrowserRouter>);
    
    expect(screen.getByText('Republic Finance')).toBeDefined();
    expect(screen.getByText('Sign in to your account')).toBeDefined();
    expect(screen.getByPlaceholderText('you@example.com')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter your password')).toBeDefined();
    expect(screen.getByText('Sign In')).toBeDefined();
  });

  // Test 2: Demo login buttons are shown
  it('shows demo account quick login buttons', async () => {
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

  // Test 3: Quick login fills form
  it('fills email and password when demo button is clicked', async () => {
    const LoginPage = (await import('../pages/LoginPage')).default;
    render(<BrowserRouter><LoginPage /></BrowserRouter>);
    
    const borrowerBtn = screen.getByText('Borrower');
    fireEvent.click(borrowerBtn);
    
    const emailInput = screen.getByPlaceholderText('you@example.com');
    expect(emailInput.value).toBe('borrower1@example.com');
  });
});

// Test 4: Register page renders
describe('RegisterPage', () => {
  it('renders registration form with all required fields', async () => {
    const RegisterPage = (await import('../pages/RegisterPage')).default;
    render(<BrowserRouter><RegisterPage /></BrowserRouter>);
    
    expect(screen.getAllByText('Create Account').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Create your borrower account')).toBeDefined();
  });
});

// Test 5: Borrower Dashboard renders empty state
describe('BorrowerDashboard', () => {
  it('shows empty state when no applications exist', async () => {
    const BorrowerDashboard = (await import('../pages/BorrowerDashboard')).default;
    render(<BrowserRouter><BorrowerDashboard /></BrowserRouter>);
    
    expect(screen.getByText('My Applications')).toBeDefined();
    expect(screen.getByText('No Applications Yet')).toBeDefined();
    expect(screen.getByText('Apply Now')).toBeDefined();
  });
});

// Test 6: Borrower Dashboard renders applications
describe('BorrowerDashboard with data', () => {
  beforeEach(() => {
    mockStore.applications = [
      {
        id: 1,
        application_number: 'APP-2024-0001',
        status: 'submitted',
        product_name: 'Personal Secured Loan',
        purpose: 'Vehicle purchase',
        requested_amount: '25000.00',
        term_months: 60,
      },
    ];
  });

  it('renders application cards when applications exist', async () => {
    const BorrowerDashboard = (await import('../pages/BorrowerDashboard')).default;
    render(<BrowserRouter><BorrowerDashboard /></BrowserRouter>);
    
    expect(screen.getByText('APP-2024-0001')).toBeDefined();
    expect(screen.getByText(/Personal Secured Loan/)).toBeDefined();
  });

  afterEach(() => {
    mockStore.applications = [];
  });
});

// Test 7: Borrower Application form renders with steps
describe('BorrowerApplication', () => {
  it('renders multi-step application form', async () => {
    const BorrowerApplication = (await import('../pages/BorrowerApplication')).default;
    render(<BrowserRouter><BorrowerApplication /></BrowserRouter>);
    
    expect(screen.getByText('Loan Application')).toBeDefined();
    expect(screen.getAllByText('Loan Details').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Personal Info')).toBeDefined();
    expect(screen.getByText('Income & Employment')).toBeDefined();
  });

  // Test 8: Step navigation works
  it('navigates to step 2 when Next is clicked', async () => {
    const BorrowerApplication = (await import('../pages/BorrowerApplication')).default;
    render(<BrowserRouter><BorrowerApplication /></BrowserRouter>);
    
    const nextBtn = screen.getByText('Next: Personal Info');
    fireEvent.click(nextBtn);
    
    expect(screen.getByText('Personal Information')).toBeDefined();
    expect(screen.getByText('SSN (last 4 digits)')).toBeDefined();
  });
});

// Test 9: StatusBadge renders correctly
describe('StatusBadge', () => {
  it('renders status with correct label', async () => {
    const StatusBadge = (await import('../components/shared/StatusBadge')).default;
    const { container } = render(<StatusBadge status="approved" />);
    
    expect(screen.getByText('Approved')).toBeDefined();
  });

  it('renders unknown status gracefully', async () => {
    const StatusBadge = (await import('../components/shared/StatusBadge')).default;
    render(<StatusBadge status="some_custom_status" />);
    
    expect(screen.getByText('some custom status')).toBeDefined();
  });
});

// Test 10: Executive Dashboard renders KPI structure
describe('ExecutiveDashboard', () => {
  beforeEach(() => {
    mockStore.dashboard = {
      total_applications: 50,
      approval_rate: 72.5,
      avg_ltv: 78.3,
      avg_time_to_fund_days: 5.2,
      total_funded_amount: 1250000,
      decline_rate: 15.0,
      volume_by_state: [
        { state: 'TX', count: '20', total_amount: '500000' },
        { state: 'FL', count: '15', total_amount: '375000' },
      ],
      volume_by_product: [
        { product_name: 'Auto Loan', count: '25' },
        { product_name: 'Personal', count: '15' },
      ],
      volume_by_branch: [
        { branch_name: 'Main', count: '30', total_amount: '750000' },
      ],
      status_breakdown: [
        { status: 'approved', count: '20' },
        { status: 'declined', count: '10' },
      ],
    };
    mockStore.loading = false;
  });

  it('renders KPI cards with dashboard data', async () => {
    const ExecutiveDashboard = (await import('../pages/ExecutiveDashboard')).default;
    render(<BrowserRouter><ExecutiveDashboard /></BrowserRouter>);
    
    expect(screen.getByText('Executive Dashboard')).toBeDefined();
    expect(screen.getByText('50')).toBeDefined();
    expect(screen.getByText('72.5%')).toBeDefined();
    expect(screen.getByText('Total Applications')).toBeDefined();
    expect(screen.getByText('Approval Rate')).toBeDefined();
  });

  afterEach(() => {
    mockStore.dashboard = null;
    mockStore.loading = false;
  });
});

// Test 11: Layout component (with mock user)
describe('Layout', () => {
  beforeEach(() => {
    mockStore.user = { first_name: 'John', last_name: 'Doe', role: 'loan_officer' };
    mockStore.isAuthenticated = true;
  });

  it('renders sidebar with user info and navigation', async () => {
    const Layout = (await import('../components/shared/Layout')).default;
    render(
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Republic Finance')).toBeDefined();
    expect(screen.getByText('John Doe')).toBeDefined();
    expect(screen.getByText('Loan Officer')).toBeDefined();
    expect(screen.getByText('Sign Out')).toBeDefined();
  });

  afterEach(() => {
    mockStore.user = null;
    mockStore.isAuthenticated = false;
  });
});
