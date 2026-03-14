const { calculateLTV, lookupVehicleByVIN, calculateValuation } = require('../src/services/collateralService');
const { calculateDTI, DECISION_BANDS } = require('../src/services/decisioningService');
const { generateTILADisclosure, calculateMonthlyPayment } = require('../src/services/tilaService');
const { checkOFAC, validateSSN } = require('../src/services/identityService');
const { generateMockCreditScore } = require('../src/services/creditService');

describe('Collateral Service', () => {
  test('calculateLTV returns correct ratio', () => {
    expect(calculateLTV(25000, 30000)).toBe(83.33);
    expect(calculateLTV(10000, 20000)).toBe(50);
    expect(calculateLTV(50000, 50000)).toBe(100);
    expect(calculateLTV(0, 10000)).toBe(0);
    expect(calculateLTV(10000, 0)).toBeNull();
  });

  test('lookupVehicleByVIN returns vehicle info for known VIN', () => {
    const result = lookupVehicleByVIN('1HGBH41JXMN109186');
    expect(result.make).toBe('Honda');
    expect(result.model).toBe('Civic');
    expect(result.year).toBe(2021);
    expect(result.vin).toBe('1HGBH41JXMN109186');
  });

  test('lookupVehicleByVIN returns generic info for unknown VIN', () => {
    const result = lookupVehicleByVIN('UNKNOWN1234567');
    expect(result).toHaveProperty('make');
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('year');
    expect(result.vin).toBe('UNKNOWN1234567');
  });

  test('calculateValuation returns NADA and KBB values', () => {
    const result = calculateValuation({ year: 2023, make: 'Honda', model: 'Civic', condition: 'good', mileage: 20000 });
    expect(result).toHaveProperty('estimated_value');
    expect(result).toHaveProperty('nada_value');
    expect(result).toHaveProperty('kbb_value');
    expect(result.estimated_value).toBeGreaterThan(0);
    expect(result.nada_value).toBeGreaterThan(0);
    expect(result.kbb_value).toBeGreaterThan(0);
  });

  test('calculateValuation applies condition multipliers', () => {
    const excellent = calculateValuation({ year: 2023, condition: 'excellent', mileage: 10000 });
    const poor = calculateValuation({ year: 2023, condition: 'poor', mileage: 10000 });
    expect(excellent.estimated_value).toBeGreaterThan(poor.estimated_value);
  });
});

describe('Decisioning Service', () => {
  test('calculateDTI returns correct ratio', () => {
    expect(calculateDTI(2000, 72000)).toBe(33.33);
    expect(calculateDTI(1000, 60000)).toBe(20);
    expect(calculateDTI(0, 60000)).toBe(0);
    expect(calculateDTI(5000, 0)).toBe(100);
  });

  test('DECISION_BANDS are properly configured', () => {
    expect(DECISION_BANDS.auto_approve.min_credit_score).toBe(700);
    expect(DECISION_BANDS.auto_approve.max_ltv).toBe(80);
    expect(DECISION_BANDS.auto_approve.max_dti).toBe(36);
    expect(DECISION_BANDS.refer.min_credit_score).toBe(620);
    expect(DECISION_BANDS.refer.max_ltv).toBe(95);
    expect(DECISION_BANDS.refer.max_dti).toBe(45);
  });
});

describe('TILA Service', () => {
  test('calculateMonthlyPayment returns correct value', () => {
    const payment = calculateMonthlyPayment(10000, 8.49, 24);
    expect(payment).toBeGreaterThan(450);
    expect(payment).toBeLessThan(460);
  });

  test('calculateMonthlyPayment with 0% rate', () => {
    const payment = calculateMonthlyPayment(12000, 0, 12);
    expect(payment).toBe(1000);
  });

  test('generateTILADisclosure returns all required fields', () => {
    const tila = generateTILADisclosure(25000, 7.99, 60);
    expect(tila).toHaveProperty('apr');
    expect(tila).toHaveProperty('finance_charge');
    expect(tila).toHaveProperty('amount_financed');
    expect(tila).toHaveProperty('total_of_payments');
    expect(tila).toHaveProperty('monthly_payment');
    expect(tila).toHaveProperty('payment_schedule');
    expect(tila.apr).toBe(7.99);
    expect(tila.amount_financed).toBe(25000);
    expect(tila.total_of_payments).toBeGreaterThan(25000);
    expect(tila.finance_charge).toBeGreaterThan(0);
    expect(tila.monthly_payment).toBeGreaterThan(0);
  });

  test('TILA disclosure total_of_payments = amount_financed + finance_charge', () => {
    const tila = generateTILADisclosure(50000, 5.99, 36);
    expect(Math.abs(tila.total_of_payments - (tila.amount_financed + tila.finance_charge))).toBeLessThan(0.02);
  });
});

describe('Identity Service', () => {
  test('checkOFAC passes for normal names', () => {
    const result = checkOFAC('John', 'Smith');
    expect(result.passed).toBe(true);
    expect(result.match_found).toBe(false);
  });

  test('checkOFAC blocks known bad names', () => {
    const result = checkOFAC('BLOCKED_TEST', 'Person');
    expect(result.passed).toBe(false);
    expect(result.match_found).toBe(true);
  });

  test('validateSSN passes for valid 4-digit SSN', () => {
    expect(validateSSN('1234').passed).toBe(true);
    expect(validateSSN('9999').passed).toBe(true);
  });

  test('validateSSN fails for invalid SSN', () => {
    expect(validateSSN('0000').passed).toBe(false);
    expect(validateSSN('abc').passed).toBe(false);
    expect(validateSSN('12345').passed).toBe(false);
    expect(validateSSN('').passed).toBe(false);
  });
});

describe('Credit Service', () => {
  test('generateMockCreditScore returns score in valid range', () => {
    const borrower = { annual_income: 75000, monthly_debt_payments: 1000, years_employed: 5 };
    const score = generateMockCreditScore(borrower);
    expect(score).toBeGreaterThanOrEqual(300);
    expect(score).toBeLessThanOrEqual(850);
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
});
