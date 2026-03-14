/**
 * Comprehensive unit tests for all backend business logic services
 * Covers: Collateral, Decisioning, TILA, Identity, Credit services
 */

const { calculateLTV, lookupVehicleByVIN, calculateValuation } = require('../src/services/collateralService');
const { calculateDTI, DECISION_BANDS } = require('../src/services/decisioningService');
const { generateTILADisclosure, calculateMonthlyPayment } = require('../src/services/tilaService');
const { checkOFAC, validateSSN } = require('../src/services/identityService');
const { generateMockCreditScore } = require('../src/services/creditService');

// ============================================================
// Collateral Service
// ============================================================

describe('Collateral Service - calculateLTV', () => {
  test('returns correct ratio for standard values', () => {
    expect(calculateLTV(25000, 30000)).toBe(83.33);
    expect(calculateLTV(10000, 20000)).toBe(50);
    expect(calculateLTV(50000, 50000)).toBe(100);
  });

  test('returns 0 when loan amount is 0', () => {
    expect(calculateLTV(0, 10000)).toBe(0);
  });

  test('returns null when collateral value is 0', () => {
    expect(calculateLTV(10000, 0)).toBeNull();
  });

  test('returns null when collateral value is null/undefined', () => {
    expect(calculateLTV(10000, null)).toBeNull();
    expect(calculateLTV(10000, undefined)).toBeNull();
  });

  test('handles high LTV ratios over 100%', () => {
    expect(calculateLTV(120000, 100000)).toBe(120);
  });

  test('handles very small values', () => {
    expect(calculateLTV(1, 100)).toBe(1);
  });

  test('handles equal values for 100% LTV', () => {
    expect(calculateLTV(75000, 75000)).toBe(100);
  });

  test('rounds to 2 decimal places', () => {
    const result = calculateLTV(10000, 30000);
    const decimals = result.toString().split('.')[1];
    expect(decimals ? decimals.length : 0).toBeLessThanOrEqual(2);
  });
});

describe('Collateral Service - lookupVehicleByVIN', () => {
  test('returns Honda Civic for known VIN prefix', () => {
    const result = lookupVehicleByVIN('1HGBH41JXMN109186');
    expect(result.make).toBe('Honda');
    expect(result.model).toBe('Civic');
    expect(result.year).toBe(2021);
    expect(result.vin).toBe('1HGBH41JXMN109186');
  });

  test('returns Tesla Model 3 for known VIN prefix', () => {
    const result = lookupVehicleByVIN('5YJ3E1EA8LF012345');
    expect(result.make).toBe('Tesla');
    expect(result.model).toBe('Model 3');
    expect(result.year).toBe(2024);
  });

  test('returns BMW 3 Series for known VIN prefix', () => {
    const result = lookupVehicleByVIN('WBAPH5C55BA012345');
    expect(result.make).toBe('BMW');
    expect(result.model).toBe('3 Series');
    expect(result.year).toBe(2023);
  });

  test('returns generic info for unknown VIN', () => {
    const result = lookupVehicleByVIN('UNKNOWN1234567');
    expect(result).toHaveProperty('make');
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('year');
    expect(result.vin).toBe('UNKNOWN1234567');
  });

  test('always includes vin field in response', () => {
    const known = lookupVehicleByVIN('1HGBH41JXMN109186');
    const unknown = lookupVehicleByVIN('XXXXXXXXXXXXXXXXX');
    expect(known.vin).toBeDefined();
    expect(unknown.vin).toBeDefined();
  });

  test('unknown VIN returns year in valid range', () => {
    const result = lookupVehicleByVIN('ZZZZZZZZZZZZZZ');
    expect(result.year).toBeGreaterThanOrEqual(2020);
    expect(result.year).toBeLessThanOrEqual(2025);
  });
});

describe('Collateral Service - calculateValuation', () => {
  test('returns NADA and KBB values', () => {
    const result = calculateValuation({ year: 2024, make: 'Honda', model: 'Civic', condition: 'good', mileage: 20000 });
    expect(result).toHaveProperty('estimated_value');
    expect(result).toHaveProperty('nada_value');
    expect(result).toHaveProperty('kbb_value');
    expect(result.estimated_value).toBeGreaterThan(0);
    expect(result.nada_value).toBeGreaterThan(0);
    expect(result.kbb_value).toBeGreaterThan(0);
  });

  test('condition multipliers: excellent > good > fair > poor', () => {
    const base = { year: 2025, make: 'Honda', model: 'Civic', mileage: 10000 };
    const excellent = calculateValuation({ ...base, condition: 'excellent' });
    const good = calculateValuation({ ...base, condition: 'good' });
    const fair = calculateValuation({ ...base, condition: 'fair' });
    const poor = calculateValuation({ ...base, condition: 'poor' });
    expect(excellent.estimated_value).toBeGreaterThan(good.estimated_value);
    expect(good.estimated_value).toBeGreaterThan(fair.estimated_value);
    expect(fair.estimated_value).toBeGreaterThan(poor.estimated_value);
  });

  test('higher mileage reduces value', () => {
    const base = { year: 2025, make: 'Honda', model: 'Civic', condition: 'good' };
    const low = calculateValuation({ ...base, mileage: 10000 });
    const high = calculateValuation({ ...base, mileage: 100000 });
    expect(low.estimated_value).toBeGreaterThan(high.estimated_value);
  });

  test('older vehicles have lower values', () => {
    const newCar = calculateValuation({ year: 2026, condition: 'good', mileage: 5000 });
    const oldCar = calculateValuation({ year: 2015, condition: 'good', mileage: 5000 });
    expect(newCar.estimated_value).toBeGreaterThan(oldCar.estimated_value);
  });

  test('handles zero mileage', () => {
    const result = calculateValuation({ year: 2025, condition: 'excellent', mileage: 0 });
    expect(result.estimated_value).toBeGreaterThan(0);
  });

  test('handles missing condition gracefully', () => {
    const result = calculateValuation({ year: 2024, mileage: 30000 });
    expect(result.estimated_value).toBeGreaterThan(0);
  });

  test('all returned values are integers (rounded)', () => {
    const result = calculateValuation({ year: 2024, condition: 'good', mileage: 20000 });
    expect(Number.isInteger(result.estimated_value)).toBe(true);
    expect(Number.isInteger(result.nada_value)).toBe(true);
    expect(Number.isInteger(result.kbb_value)).toBe(true);
  });
});

// ============================================================
// Decisioning Service
// ============================================================

describe('Decisioning Service - calculateDTI', () => {
  test('returns correct DTI for standard values', () => {
    expect(calculateDTI(2000, 72000)).toBe(33.33);
    expect(calculateDTI(1000, 60000)).toBe(20);
  });

  test('returns 0 when no debt', () => {
    expect(calculateDTI(0, 60000)).toBe(0);
  });

  test('returns 100 when no income', () => {
    expect(calculateDTI(5000, 0)).toBe(100);
  });

  test('handles high DTI ratios', () => {
    expect(calculateDTI(4000, 48000)).toBe(100);
  });

  test('handles low DTI ratios', () => {
    expect(calculateDTI(100, 120000)).toBe(1);
  });

  test('correctly converts annual to monthly income', () => {
    expect(calculateDTI(1000, 60000)).toBe(20);
  });

  test('rounds to 2 decimal places', () => {
    const result = calculateDTI(1500, 72000);
    const decimals = result.toString().split('.')[1];
    expect(decimals ? decimals.length : 0).toBeLessThanOrEqual(2);
  });

  test('handles negative income as zero', () => {
    const result = calculateDTI(1000, -5000);
    expect(result).toBe(100);
  });
});

describe('Decisioning Service - DECISION_BANDS', () => {
  test('auto_approve bands are properly configured', () => {
    expect(DECISION_BANDS.auto_approve.min_credit_score).toBe(700);
    expect(DECISION_BANDS.auto_approve.max_ltv).toBe(80);
    expect(DECISION_BANDS.auto_approve.max_dti).toBe(36);
  });

  test('refer bands are properly configured', () => {
    expect(DECISION_BANDS.refer.min_credit_score).toBe(620);
    expect(DECISION_BANDS.refer.max_ltv).toBe(95);
    expect(DECISION_BANDS.refer.max_dti).toBe(45);
  });

  test('refer thresholds are more lenient than auto_approve', () => {
    expect(DECISION_BANDS.refer.min_credit_score).toBeLessThan(DECISION_BANDS.auto_approve.min_credit_score);
    expect(DECISION_BANDS.refer.max_ltv).toBeGreaterThan(DECISION_BANDS.auto_approve.max_ltv);
    expect(DECISION_BANDS.refer.max_dti).toBeGreaterThan(DECISION_BANDS.auto_approve.max_dti);
  });

  test('band configuration has correct keys', () => {
    expect(DECISION_BANDS).toHaveProperty('auto_approve');
    expect(DECISION_BANDS).toHaveProperty('refer');
    expect(DECISION_BANDS.auto_approve).toHaveProperty('min_credit_score');
    expect(DECISION_BANDS.auto_approve).toHaveProperty('max_ltv');
    expect(DECISION_BANDS.auto_approve).toHaveProperty('max_dti');
  });
});

// ============================================================
// TILA Service
// ============================================================

describe('TILA Service - calculateMonthlyPayment', () => {
  test('returns correct payment for standard loan', () => {
    const payment = calculateMonthlyPayment(10000, 8.49, 24);
    expect(payment).toBeGreaterThan(450);
    expect(payment).toBeLessThan(460);
  });

  test('returns principal/term for 0% rate', () => {
    expect(calculateMonthlyPayment(12000, 0, 12)).toBe(1000);
    expect(calculateMonthlyPayment(24000, 0, 24)).toBe(1000);
  });

  test('higher rate increases monthly payment', () => {
    const low = calculateMonthlyPayment(25000, 5, 60);
    const high = calculateMonthlyPayment(25000, 15, 60);
    expect(high).toBeGreaterThan(low);
  });

  test('longer term reduces monthly payment', () => {
    const short = calculateMonthlyPayment(25000, 8, 24);
    const long = calculateMonthlyPayment(25000, 8, 60);
    expect(short).toBeGreaterThan(long);
  });

  test('higher principal increases monthly payment', () => {
    const small = calculateMonthlyPayment(10000, 8, 36);
    const large = calculateMonthlyPayment(50000, 8, 36);
    expect(large).toBeGreaterThan(small);
  });

  test('payment is always positive for valid inputs', () => {
    expect(calculateMonthlyPayment(1000, 5, 12)).toBeGreaterThan(0);
    expect(calculateMonthlyPayment(100000, 15, 360)).toBeGreaterThan(0);
  });
});

describe('TILA Service - generateTILADisclosure', () => {
  test('returns all required TILA fields', () => {
    const tila = generateTILADisclosure(25000, 7.99, 60);
    expect(tila).toHaveProperty('apr');
    expect(tila).toHaveProperty('finance_charge');
    expect(tila).toHaveProperty('amount_financed');
    expect(tila).toHaveProperty('total_of_payments');
    expect(tila).toHaveProperty('monthly_payment');
    expect(tila).toHaveProperty('payment_schedule');
  });

  test('APR equals the input rate', () => {
    expect(generateTILADisclosure(25000, 7.99, 60).apr).toBe(7.99);
    expect(generateTILADisclosure(10000, 12.5, 36).apr).toBe(12.5);
  });

  test('amount_financed equals the principal', () => {
    expect(generateTILADisclosure(50000, 5.99, 36).amount_financed).toBe(50000);
    expect(generateTILADisclosure(10000, 8, 24).amount_financed).toBe(10000);
  });

  test('total_of_payments equals amount_financed plus finance_charge', () => {
    const tila = generateTILADisclosure(50000, 5.99, 36);
    expect(Math.abs(tila.total_of_payments - (tila.amount_financed + tila.finance_charge))).toBeLessThan(0.02);
  });

  test('finance_charge is positive for non-zero rate', () => {
    expect(generateTILADisclosure(25000, 10, 48).finance_charge).toBeGreaterThan(0);
    expect(generateTILADisclosure(15000, 5, 24).finance_charge).toBeGreaterThan(0);
  });

  test('finance_charge is 0 for 0% rate', () => {
    expect(generateTILADisclosure(10000, 0, 12).finance_charge).toBe(0);
  });

  test('payment_schedule includes term months', () => {
    expect(generateTILADisclosure(25000, 8, 48).payment_schedule).toContain('48');
    expect(generateTILADisclosure(10000, 5, 36).payment_schedule).toContain('36');
  });

  test('monthly_payment is positive', () => {
    expect(generateTILADisclosure(15000, 9.99, 36).monthly_payment).toBeGreaterThan(0);
  });

  test('longer term means higher total cost but lower monthly payment', () => {
    const short = generateTILADisclosure(25000, 8, 24);
    const long = generateTILADisclosure(25000, 8, 60);
    expect(long.total_of_payments).toBeGreaterThan(short.total_of_payments);
    expect(long.finance_charge).toBeGreaterThan(short.finance_charge);
    expect(long.monthly_payment).toBeLessThan(short.monthly_payment);
  });

  test('monthly_payment is rounded to 2 decimal places', () => {
    const tila = generateTILADisclosure(25000, 7.99, 60);
    const decimals = tila.monthly_payment.toString().split('.')[1];
    expect(decimals ? decimals.length : 0).toBeLessThanOrEqual(2);
  });
});

// ============================================================
// Identity Service
// ============================================================

describe('Identity Service - checkOFAC', () => {
  test('passes for normal names', () => {
    const result = checkOFAC('John', 'Smith');
    expect(result.passed).toBe(true);
    expect(result.match_found).toBe(false);
  });

  test('passes for various valid names', () => {
    expect(checkOFAC('Jane', 'Doe').passed).toBe(true);
    expect(checkOFAC('Robert', 'Johnson').passed).toBe(true);
    expect(checkOFAC('Maria', 'Garcia').passed).toBe(true);
  });

  test('blocks known bad name BLOCKED_TEST', () => {
    const result = checkOFAC('BLOCKED_TEST', 'Person');
    expect(result.passed).toBe(false);
    expect(result.match_found).toBe(true);
  });

  test('blocks known bad name SANCTIONS_TEST', () => {
    const result = checkOFAC('SANCTIONS_TEST', 'Individual');
    expect(result.passed).toBe(false);
    expect(result.match_found).toBe(true);
  });

  test('returns source field as OFAC_SDN', () => {
    expect(checkOFAC('John', 'Smith').source).toBe('OFAC_SDN');
  });

  test('returns checked_at timestamp', () => {
    const result = checkOFAC('John', 'Smith');
    expect(result).toHaveProperty('checked_at');
    expect(new Date(result.checked_at).getTime()).not.toBeNaN();
  });

  test('returns details field', () => {
    expect(checkOFAC('John', 'Smith').details).toContain('No match');
    expect(checkOFAC('BLOCKED_TEST', 'X').details).toContain('match found');
  });

  test('name check is case-insensitive', () => {
    const result = checkOFAC('blocked_test', 'person');
    expect(result.passed).toBe(false);
  });
});

describe('Identity Service - validateSSN', () => {
  test('passes for valid 4-digit SSN', () => {
    expect(validateSSN('1234').passed).toBe(true);
    expect(validateSSN('9999').passed).toBe(true);
    expect(validateSSN('0001').passed).toBe(true);
    expect(validateSSN('5678').passed).toBe(true);
  });

  test('fails for 0000 invalid SSN', () => {
    expect(validateSSN('0000').passed).toBe(false);
  });

  test('fails for non-numeric input', () => {
    expect(validateSSN('abcd').passed).toBe(false);
    expect(validateSSN('12ab').passed).toBe(false);
  });

  test('fails for wrong length', () => {
    expect(validateSSN('12345').passed).toBe(false);
    expect(validateSSN('123').passed).toBe(false);
    expect(validateSSN('1').passed).toBe(false);
  });

  test('fails for empty input', () => {
    expect(validateSSN('').passed).toBe(false);
  });

  test('returns source field as SSN_VALIDATION', () => {
    expect(validateSSN('1234').source).toBe('SSN_VALIDATION');
  });

  test('returns checked_at timestamp', () => {
    const result = validateSSN('1234');
    expect(result).toHaveProperty('checked_at');
    expect(new Date(result.checked_at).getTime()).not.toBeNaN();
  });

  test('returns details message', () => {
    expect(validateSSN('1234').details).toContain('validated');
    expect(validateSSN('0000').details).toContain('Invalid');
  });
});

// ============================================================
// Credit Service
// ============================================================

describe('Credit Service - generateMockCreditScore', () => {
  test('returns score in valid range 300-850', () => {
    const score = generateMockCreditScore({ annual_income: 75000, monthly_debt_payments: 1000, years_employed: 5 });
    expect(score).toBeGreaterThanOrEqual(300);
    expect(score).toBeLessThanOrEqual(850);
  });

  test('returns integer score', () => {
    const score = generateMockCreditScore({ annual_income: 50000, monthly_debt_payments: 500, years_employed: 3 });
    expect(Number.isInteger(score)).toBe(true);
  });

  test('higher income borrower gets higher score on average', () => {
    const scores = { high: [], low: [] };
    for (let i = 0; i < 100; i++) {
      scores.high.push(generateMockCreditScore({ annual_income: 150000, monthly_debt_payments: 500, years_employed: 10 }));
      scores.low.push(generateMockCreditScore({ annual_income: 25000, monthly_debt_payments: 2000, years_employed: 0 }));
    }
    const avgHigh = scores.high.reduce((a, b) => a + b) / scores.high.length;
    const avgLow = scores.low.reduce((a, b) => a + b) / scores.low.length;
    expect(avgHigh).toBeGreaterThan(avgLow);
  });

  test('handles zero income borrower', () => {
    const score = generateMockCreditScore({ annual_income: 0, monthly_debt_payments: 0, years_employed: 0 });
    expect(score).toBeGreaterThanOrEqual(300);
    expect(score).toBeLessThanOrEqual(850);
  });

  test('handles high income borrower', () => {
    const score = generateMockCreditScore({ annual_income: 500000, monthly_debt_payments: 0, years_employed: 30 });
    expect(score).toBeGreaterThanOrEqual(300);
    expect(score).toBeLessThanOrEqual(850);
  });

  test('score is never below 300 or above 850 across many samples', () => {
    for (let i = 0; i < 50; i++) {
      const score = generateMockCreditScore({
        annual_income: Math.random() * 200000,
        monthly_debt_payments: Math.random() * 5000,
        years_employed: Math.random() * 40,
      });
      expect(score).toBeGreaterThanOrEqual(300);
      expect(score).toBeLessThanOrEqual(850);
    }
  });

  test('handles missing fields gracefully', () => {
    const score = generateMockCreditScore({});
    expect(score).toBeGreaterThanOrEqual(300);
    expect(score).toBeLessThanOrEqual(850);
  });

  test('low debt relative to income produces reasonable score', () => {
    const scores = [];
    for (let i = 0; i < 50; i++) {
      scores.push(generateMockCreditScore({ annual_income: 120000, monthly_debt_payments: 200, years_employed: 10 }));
    }
    const avg = scores.reduce((a, b) => a + b) / scores.length;
    expect(avg).toBeGreaterThan(650);
  });
});
