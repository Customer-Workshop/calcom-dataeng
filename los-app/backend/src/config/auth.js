require('dotenv').config();

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-me',
  jwtExpiry: process.env.JWT_EXPIRY || '1h',
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  saltRounds: 12,
  roles: {
    BORROWER: 'borrower',
    LOAN_OFFICER: 'loan_officer',
    BRANCH_MANAGER: 'branch_manager',
    UNDERWRITER: 'underwriter',
    COMPLIANCE_OFFICER: 'compliance_officer',
    SYSTEM_ADMIN: 'system_admin',
    EXECUTIVE: 'executive',
  },
  // Role-based loan amount authority limits
  authorityLimits: {
    loan_officer: 100000,
    branch_manager: 500000,
    underwriter: 1000000,
    compliance_officer: 1000000,
    system_admin: Infinity,
  },
};
