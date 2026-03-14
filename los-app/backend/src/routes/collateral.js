const express = require('express');
const { db } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { upsertCollateral, lookupVehicleByVIN, calculateValuation, calculateLTV } = require('../services/collateralService');
const { createAuditLog } = require('../utils/audit');

const router = express.Router();

/** GET /api/collateral/:applicationId - Get collateral for an application */
router.get('/:applicationId', authenticate, async (req, res) => {
  try {
    const collateral = await db('collateral').where('application_id', req.params.applicationId);
    const valuations = [];
    for (const c of collateral) {
      const vals = await db('valuations').where('collateral_id', c.id);
      valuations.push(...vals);
    }
    res.json({ collateral, valuations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch collateral' });
  }
});

/** POST /api/collateral/:applicationId - Create/update collateral with VIN auto-populate */
router.post('/:applicationId', authenticate, authorize('borrower', 'loan_officer', 'branch_manager', 'system_admin'),
  validateBody(schemas.collateral), async (req, res) => {
  try {
    const result = await upsertCollateral(parseInt(req.params.applicationId), req.body, req.user.id);

    // Recalculate LTV for the application
    const application = await db('applications').where('id', req.params.applicationId).first();
    if (application && result.estimated_value) {
      const ltv = calculateLTV(parseFloat(application.requested_amount), parseFloat(result.estimated_value));
      if (ltv !== null) {
        await db('applications').where('id', req.params.applicationId).update({ ltv_ratio: ltv });
      }
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Collateral creation error:', error);
    res.status(500).json({ error: 'Failed to save collateral' });
  }
});

/** GET /api/collateral/vin-lookup/:vin - Look up vehicle by VIN */
router.get('/vin-lookup/:vin', authenticate, async (req, res) => {
  try {
    const vehicle = lookupVehicleByVIN(req.params.vin);
    const valuation = calculateValuation({ ...vehicle, condition: req.query.condition || 'good', mileage: parseInt(req.query.mileage || '0') });
    res.json({ ...vehicle, ...valuation });
  } catch (error) {
    res.status(500).json({ error: 'VIN lookup failed' });
  }
});

/** POST /api/collateral/:id/photos - Upload collateral photos */
router.post('/:id/photos', authenticate, async (req, res) => {
  try {
    const collateral = await db('collateral').where('id', req.params.id).first();
    if (!collateral) return res.status(404).json({ error: 'Collateral not found' });

    const existingPhotos = collateral.photo_urls ? JSON.parse(collateral.photo_urls) : [];
    const newPhotoUrl = `mock://photos/collateral-${req.params.id}-${Date.now()}.jpg`;
    existingPhotos.push(newPhotoUrl);

    await db('collateral').where('id', req.params.id).update({ photo_urls: JSON.stringify(existingPhotos) });

    await createAuditLog({
      userId: req.user.id,
      action: 'collateral_photo_uploaded',
      entityType: 'collateral',
      entityId: parseInt(req.params.id),
      details: { photoUrl: newPhotoUrl },
    });

    res.json({ photo_urls: existingPhotos });
  } catch (error) {
    res.status(500).json({ error: 'Photo upload failed' });
  }
});

module.exports = router;
