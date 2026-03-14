/**
 * TILA (Truth in Lending Act) disclosure calculation service.
 * Calculates APR, finance charge, total of payments, and monthly payment.
 */

/** Calculate monthly payment using standard amortization formula */
function calculateMonthlyPayment(principal, annualRate, termMonths) {
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / termMonths;
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
}

/** Generate full TILA disclosure data */
function generateTILADisclosure(principal, annualRate, termMonths) {
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, termMonths);
  const totalOfPayments = monthlyPayment * termMonths;
  const financeCharge = totalOfPayments - principal;

  return {
    apr: annualRate,
    finance_charge: Math.round(financeCharge * 100) / 100,
    amount_financed: principal,
    total_of_payments: Math.round(totalOfPayments * 100) / 100,
    monthly_payment: Math.round(monthlyPayment * 100) / 100,
    payment_schedule: `${termMonths} monthly payments of $${(Math.round(monthlyPayment * 100) / 100).toLocaleString()}`,
  };
}

module.exports = { calculateMonthlyPayment, generateTILADisclosure };
