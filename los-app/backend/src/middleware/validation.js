const { z } = require('zod');

/**
 * Middleware factory: Validate request body against a Zod schema
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(err);
    }
  };
}

/**
 * Middleware factory: Validate query parameters against a Zod schema
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(err);
    }
  };
}

// Common Zod schemas for validation
const schemas = {
  login: z.object({
    email: z.string().email('Valid email required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),

  register: z.object({
    email: z.string().email('Valid email required'),
    password: z.string().min(12, 'Password must be at least 12 characters'),
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    phone: z.string().optional(),
    role_id: z.number().optional(),
  }),

  application: z.object({
    loan_product_id: z.number().int().positive(),
    requested_amount: z.number().positive(),
    term_months: z.number().int().positive(),
    purpose: z.string().min(1, 'Purpose is required'),
    state: z.string().length(2, 'State must be 2-letter code'),
    borrower_info: z.object({
      ssn_last_four: z.string().length(4).optional(),
      date_of_birth: z.string().optional(),
      address_street: z.string().optional(),
      address_city: z.string().optional(),
      address_state: z.string().length(2).optional(),
      address_zip: z.string().optional(),
      employer_name: z.string().optional(),
      employment_status: z.enum(['employed', 'self_employed', 'retired', 'unemployed']).optional(),
      annual_income: z.number().positive().optional(),
      monthly_debt_payments: z.number().min(0).optional(),
      income_source: z.string().optional(),
      years_employed: z.number().min(0).optional(),
    }).optional(),
    co_borrower_info: z.object({
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().email().optional(),
      ssn_last_four: z.string().length(4).optional(),
      annual_income: z.number().positive().optional(),
    }).optional(),
  }),

  collateral: z.object({
    type: z.enum(['vehicle', 'property', 'equipment']),
    vin: z.string().max(17).optional(),
    year: z.number().int().optional(),
    make: z.string().optional(),
    model: z.string().optional(),
    trim: z.string().optional(),
    mileage: z.number().int().min(0).optional(),
    condition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
    condition_notes: z.string().optional(),
    property_address: z.string().optional(),
  }),

  decision: z.object({
    decision_type: z.enum(['manual_approve', 'manual_decline', 'counter_offer', 'refer']),
    approved_amount: z.number().positive().optional(),
    approved_rate: z.number().positive().optional(),
    approved_term: z.number().int().positive().optional(),
    reason_codes: z.array(z.string()).optional(),
    conditions: z.array(z.string()).optional(),
    notes: z.string().optional(),
  }),

  condition: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    category: z.enum(['prior_to_approval', 'prior_to_funding', 'prior_to_closing']),
    assigned_to: z.number().int().positive().optional(),
    due_date: z.string().optional(),
  }),

  stateRule: z.object({
    state: z.string().length(2),
    state_name: z.string().min(1),
    is_enabled: z.boolean().optional(),
    max_rate_cap: z.number().positive().optional(),
    max_fee_percentage: z.number().min(0).optional(),
    max_fee_flat: z.number().min(0).optional(),
    min_loan_amount: z.number().min(0).optional(),
    max_loan_amount: z.number().positive().optional(),
    disclosure_language: z.string().optional(),
    additional_rules: z.string().optional(),
    right_of_rescission: z.boolean().optional(),
    rescission_days: z.number().int().min(0).optional(),
  }),

  createUser: z.object({
    email: z.string().email(),
    password: z.string().min(12),
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    phone: z.string().optional(),
    role_id: z.number().int().positive(),
    branch_id: z.number().int().positive().optional(),
  }),

  fundingInstruction: z.object({
    disbursement_method: z.enum(['ach', 'wire', 'check']).optional(),
    account_number: z.string().optional(),
    routing_number: z.string().optional(),
    account_holder_name: z.string().optional(),
    amount: z.number().positive(),
  }),

  eSignature: z.object({
    signature_data: z.string().min(1, 'Signature data is required'),
    signer_name: z.string().min(1),
  }),
};

module.exports = { validateBody, validateQuery, schemas };
