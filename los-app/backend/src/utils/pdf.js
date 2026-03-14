const PDFDocument = require('pdfkit');

/**
 * Generate a loan agreement PDF document (mock e-signature flow)
 * Returns a buffer containing the PDF
 */
function generateLoanAgreementPDF({ loan, borrower, application }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text('LOAN AGREEMENT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Loan Number: ${loan.loan_number || 'PENDING'}`, { align: 'center' });
    doc.text(`Application: ${application.application_number}`, { align: 'center' });
    doc.moveDown(2);

    // Borrower Info
    doc.fontSize(14).text('BORROWER INFORMATION', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Name: ${borrower.first_name || ''} ${borrower.last_name || ''}`);
    doc.text(`Address: ${borrower.address_street || ''}, ${borrower.address_city || ''}, ${borrower.address_state || ''} ${borrower.address_zip || ''}`);
    doc.moveDown();

    // Loan Terms
    doc.fontSize(14).text('LOAN TERMS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Principal Amount: $${parseFloat(application.approved_amount || application.requested_amount).toLocaleString()}`);
    doc.text(`Annual Percentage Rate (APR): ${application.interest_rate}%`);
    doc.text(`Term: ${application.term_months} months`);
    if (loan.monthly_payment) doc.text(`Monthly Payment: $${parseFloat(loan.monthly_payment).toLocaleString()}`);
    if (loan.total_of_payments) doc.text(`Total of Payments: $${parseFloat(loan.total_of_payments).toLocaleString()}`);
    if (loan.finance_charge) doc.text(`Finance Charge: $${parseFloat(loan.finance_charge).toLocaleString()}`);
    doc.moveDown();

    // TILA Disclosure
    doc.fontSize(14).text('TRUTH IN LENDING DISCLOSURE (TILA)', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text('Federal law requires disclosure of the following:');
    doc.text(`  APR: ${application.interest_rate}%`);
    doc.text(`  Finance Charge: $${(loan.finance_charge || 0).toLocaleString()}`);
    doc.text(`  Amount Financed: $${parseFloat(application.approved_amount || application.requested_amount).toLocaleString()}`);
    doc.text(`  Total of Payments: $${(loan.total_of_payments || 0).toLocaleString()}`);
    doc.moveDown();

    // Signature Block
    doc.moveDown(2);
    doc.fontSize(12).text('SIGNATURES', { underline: true });
    doc.moveDown();
    doc.text('Borrower Signature: ________________________________    Date: ____________');
    doc.moveDown();
    doc.text('Lender Authorized Signature: _______________________    Date: ____________');
    doc.moveDown(2);

    doc.fontSize(8).text('This is a mock loan agreement generated for demonstration purposes.', { align: 'center' });

    doc.end();
  });
}

/**
 * Generate an adverse action notice PDF (ECOA compliant)
 */
function generateAdverseActionPDF({ application, borrower, reasons }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(18).text('NOTICE OF ADVERSE ACTION', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Date: ${new Date().toLocaleDateString()}`);
    doc.text(`Application Number: ${application.application_number}`);
    doc.moveDown();

    doc.fontSize(12).text('Dear Applicant,');
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text('We regret to inform you that your application for credit has been denied. This notice is provided in accordance with the Equal Credit Opportunity Act (ECOA) and the Fair Credit Reporting Act (FCRA).');
    doc.moveDown();

    doc.fontSize(12).text('REASONS FOR DENIAL:', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    const reasonList = Array.isArray(reasons) ? reasons : JSON.parse(reasons || '[]');
    reasonList.forEach((reason, i) => {
      doc.text(`${i + 1}. ${reason}`);
    });
    doc.moveDown();

    doc.text('CREDIT REPORTING AGENCY INFORMATION:');
    doc.text('The credit bureau(s) listed below provided information that was considered in the decision:');
    doc.text('  Mock Credit Bureau, 123 Bureau St, Anytown, US 00000');
    doc.text('  Phone: 1-800-555-0000');
    doc.moveDown();

    doc.text('YOUR RIGHTS:');
    doc.text('You have the right to obtain a free copy of your credit report within 60 days.');
    doc.text('You have the right to dispute inaccurate information in your credit report.');
    doc.text('The Federal Equal Credit Opportunity Act prohibits discrimination on the basis of race, color, religion, national origin, sex, marital status, or age.');
    doc.moveDown(2);

    doc.fontSize(8).text('This is a mock adverse action notice generated for demonstration purposes.', { align: 'center' });

    doc.end();
  });
}

module.exports = { generateLoanAgreementPDF, generateAdverseActionPDF };
