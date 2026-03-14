const { db } = require('../config/database');

/**
 * Mock email/SMS notification system.
 * In production, this would integrate with SendGrid, Twilio, etc.
 * All notifications are logged to console and stored in the notifications table.
 */
async function sendNotification({ userId, applicationId, type, template, recipient, subject, body }) {
  console.log(`[NOTIFICATION] ${type.toUpperCase()} to ${recipient}: ${subject}`);
  console.log(`  Body: ${body}`);

  try {
    await db('notifications').insert({
      user_id: userId,
      application_id: applicationId,
      type,
      template,
      recipient,
      subject,
      body,
      status: 'sent',
    });
  } catch (error) {
    console.error('Notification storage failed:', error.message);
  }
}

/** Send application status update notification */
async function notifyStatusChange(application, newStatus) {
  const statusMessages = {
    submitted: 'Your loan application has been submitted and is under review.',
    pre_qualified: 'Congratulations! You have been pre-qualified for your loan.',
    credit_pulled: 'Your credit report has been pulled as part of the application process.',
    identity_verified: 'Your identity has been verified successfully.',
    income_verified: 'Your income information has been verified.',
    underwriting: 'Your application has been sent to underwriting for review.',
    approved: 'Congratulations! Your loan application has been approved!',
    conditionally_approved: 'Your loan has been conditionally approved. Please fulfill the listed conditions.',
    counter_offered: 'A counter-offer has been made on your application. Please review.',
    declined: 'We regret to inform you that your application has been declined.',
    docs_sent: 'Your loan documents are ready for review and signature.',
    e_signed: 'Your loan documents have been signed electronically.',
    funding_authorized: 'Your loan funding has been authorized.',
    funded: 'Your loan has been funded! Funds will be disbursed shortly.',
  };

  const message = statusMessages[newStatus] || `Your application status has been updated to: ${newStatus}`;

  await sendNotification({
    applicationId: application.id,
    type: 'email',
    template: 'status_update',
    recipient: 'borrower@example.com',
    subject: `Loan Application ${application.application_number} - Status Update`,
    body: message,
  });

  await sendNotification({
    applicationId: application.id,
    type: 'sms',
    template: 'status_update_sms',
    recipient: '+15555550000',
    subject: 'Application Update',
    body: `LOS: ${message.substring(0, 140)}`,
  });
}

module.exports = { sendNotification, notifyStatusChange };
