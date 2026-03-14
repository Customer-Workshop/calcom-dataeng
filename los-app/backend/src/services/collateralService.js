const { db } = require('../config/database');
const { createAuditLog } = require('../utils/audit');

/**
 * Mock vehicle valuation service.
 * Simulates NADA/KBB lookup based on VIN.
 * In production, would integrate with real NADA/KBB APIs.
 */

/** VIN-based vehicle database (mock) */
const VEHICLE_DATABASE = {
  '1HGBH41JXMN1': { year: 2021, make: 'Honda', model: 'Civic', trim: 'EX' },
  '5YJ3E1EA8LF0': { year: 2024, make: 'Tesla', model: 'Model 3', trim: 'Long Range' },
  'WBAPH5C55BA0': { year: 2023, make: 'BMW', model: '3 Series', trim: '330i' },
  'WP0AB2A75NS0': { year: 2024, make: 'Porsche', model: 'Cayenne', trim: 'Base' },
  '1G1YY22G6551': { year: 2020, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray' },
  'JH4KA8260MC0': { year: 2022, make: 'Acura', model: 'TLX', trim: 'A-Spec' },
  '2T1BURHE0JC0': { year: 2023, make: 'Toyota', model: 'Corolla', trim: 'SE' },
  'KNMAT2MV5KP0': { year: 2024, make: 'Nissan', model: 'Rogue', trim: 'SV' },
};

/** Look up vehicle info from VIN (mock auto-populate) */
function lookupVehicleByVIN(vin) {
  const prefix = vin.substring(0, 12);
  const vehicle = VEHICLE_DATABASE[prefix];
  if (vehicle) return { ...vehicle, vin };

  // Generate a generic lookup for unknown VINs
  const year = 2020 + Math.floor(Math.random() * 5);
  const makes = ['Ford', 'Toyota', 'Honda', 'Chevrolet', 'Nissan', 'Hyundai'];
  const models = ['Sedan', 'SUV', 'Truck', 'Coupe'];
  return {
    vin,
    year,
    make: makes[Math.floor(Math.random() * makes.length)],
    model: models[Math.floor(Math.random() * models.length)],
    trim: 'Standard',
  };
}

/** Calculate mock NADA/KBB valuation based on vehicle attributes and condition */
function calculateValuation(vehicle) {
  // Base values by approximate vehicle class
  let baseValue = 25000;
  const currentYear = new Date().getFullYear();
  const age = currentYear - (vehicle.year || currentYear);

  // Depreciation: ~15% first year, ~10% per year after
  let depreciation = 1;
  if (age >= 1) depreciation -= 0.15;
  if (age >= 2) depreciation -= 0.10 * Math.min(age - 1, 8);
  depreciation = Math.max(depreciation, 0.15);

  // Condition multipliers
  const conditionMultipliers = {
    excellent: 1.10,
    good: 1.00,
    fair: 0.85,
    poor: 0.65,
  };

  // Mileage adjustment
  const mileage = vehicle.mileage || 0;
  let mileageAdj = 1;
  if (mileage > 100000) mileageAdj = 0.75;
  else if (mileage > 75000) mileageAdj = 0.85;
  else if (mileage > 50000) mileageAdj = 0.92;
  else if (mileage < 10000) mileageAdj = 1.05;

  const condMult = conditionMultipliers[vehicle.condition] || 1.00;
  const value = Math.round(baseValue * depreciation * condMult * mileageAdj);

  // NADA and KBB differ slightly
  const nadaValue = Math.round(value * (1 + (Math.random() * 0.04 - 0.02)));
  const kbbValue = Math.round(value * (1 + (Math.random() * 0.04 - 0.02)));

  return {
    estimated_value: value,
    nada_value: nadaValue,
    kbb_value: kbbValue,
  };
}

/** Create or update collateral for an application */
async function upsertCollateral(applicationId, collateralData, userId) {
  let vehicleInfo = {};
  let valuation = {};

  // Auto-populate from VIN if provided
  if (collateralData.vin && collateralData.type === 'vehicle') {
    vehicleInfo = lookupVehicleByVIN(collateralData.vin);
    valuation = calculateValuation({
      ...vehicleInfo,
      condition: collateralData.condition,
      mileage: collateralData.mileage,
    });
  }

  const record = {
    application_id: applicationId,
    type: collateralData.type,
    vin: collateralData.vin || null,
    year: collateralData.year || vehicleInfo.year || null,
    make: collateralData.make || vehicleInfo.make || null,
    model: collateralData.model || vehicleInfo.model || null,
    trim: collateralData.trim || vehicleInfo.trim || null,
    mileage: collateralData.mileage || null,
    condition: collateralData.condition || null,
    condition_notes: collateralData.condition_notes || null,
    estimated_value: valuation.estimated_value || collateralData.estimated_value || null,
    nada_value: valuation.nada_value || null,
    kbb_value: valuation.kbb_value || null,
    valuation_source: collateralData.vin ? 'nada' : 'manual',
    property_address: collateralData.property_address || null,
    photo_urls: collateralData.photo_urls ? JSON.stringify(collateralData.photo_urls) : null,
  };

  // Check if collateral already exists for this application
  const existing = await db('collateral').where('application_id', applicationId).first();
  let result;

  if (existing) {
    [result] = await db('collateral').where('id', existing.id).update({ ...record, updated_at: new Date() }).returning('*');
  } else {
    [result] = await db('collateral').insert(record).returning('*');
  }

  // Create valuation record if applicable
  if (valuation.estimated_value) {
    await db('valuations').insert({
      collateral_id: result.id,
      source: collateralData.vin ? 'nada' : 'manual',
      value: valuation.estimated_value,
      valuation_date: new Date(),
      details: JSON.stringify(valuation),
    });
  }

  await createAuditLog({
    userId,
    action: existing ? 'collateral_updated' : 'collateral_created',
    entityType: 'collateral',
    entityId: result.id,
    details: { applicationId, type: collateralData.type, value: valuation.estimated_value },
  });

  return result;
}

/** Calculate LTV ratio: loan amount ÷ collateral value */
function calculateLTV(loanAmount, collateralValue) {
  if (!collateralValue || collateralValue === 0) return null;
  return Math.round((loanAmount / collateralValue) * 10000) / 100;
}

module.exports = { lookupVehicleByVIN, calculateValuation, upsertCollateral, calculateLTV };
