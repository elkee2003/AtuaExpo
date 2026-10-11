import { PRICING_CONFIG } from "../config/pricingConfig";

// ============================================================
// MAXI BID / FREIGHT PRICING
// ============================================================
//
// This calculates the suggested bidding range for a Maxi order.
//
// IMPORTANT:
// - perKm is the COMPLETE amount charged per kilometre.
// - Fuel and maintenance are already assumed to be covered
//   within the configured perKm rate.
// - This function does NOT calculate the final customer payment.
// - The final customer payment is calculated only after the
//   user and courier agree on an offer.
//
// Base calculation:
//
// baseFare + (distanceKm × perKm)
//
// Then applicable minimum fare, load adjustments, interstate
// adjustment, and extras are applied.
// ============================================================

export const freightPricingEngine = ({
  type,
  distanceKm,
  loadCategory,
  isInterState,
  loadingFee = 0,
  unloadingFee = 0,
  floorSurcharge = 0,
  fragileSurcharge = 0,
}) => {
  const config = PRICING_CONFIG[type];

  if (!config) {
    return null;
  }

  // ==========================================================
  // DISTANCE VALIDATION
  // ==========================================================

  const distance = Number(distanceKm);

  if (!Number.isFinite(distance) || distance < 0) {
    return null;
  }

  // ==========================================================
  // BASE FARE
  // ==========================================================
  //
  // perKm is the COMPLETE customer rate per kilometre.
  //
  // Example:
  //
  // baseFare = ₦12,000
  // perKm = ₦1,600
  // distance = 30 km
  //
  // 12,000 + (30 × 1,600)
  // = ₦60,000
  //
  // NO fuel or maintenance is added separately.
  // ==========================================================

  let base = config.baseFare + distance * config.perKm;

  // ==========================================================
  // MINIMUM FARE
  // ==========================================================

  if (base < config.minFare) {
    base = config.minFare;
  }

  // ==========================================================
  // LOAD CATEGORY
  // ==========================================================

  if (loadCategory === "BUILDING_MATERIAL") {
    base *= 1.15;
  }

  if (loadCategory === "FRAGILE") {
    base *= 1.2;
  }

  // ==========================================================
  // INTERSTATE
  // ==========================================================

  if (isInterState) {
    base *= 1.25;
  }

  // ==========================================================
  // EXTRAS
  // ==========================================================

  const extrasTotal =
    Number(loadingFee) +
    Number(unloadingFee) +
    Number(floorSurcharge) +
    Number(fragileSurcharge);

  // Prevent invalid extras from producing NaN.
  if (!Number.isFinite(extrasTotal)) {
    return null;
  }

  // ==========================================================
  // FINAL REFERENCE PRICE
  // ==========================================================

  const finalPrice = Math.round(base + extrasTotal);

  // ==========================================================
  // SUGGESTED BIDDING RANGE
  // ==========================================================

  const minSuggested = Math.round(finalPrice * 0.95);

  const maxSuggested = Math.round(finalPrice * 1.15);

  // ==========================================================
  // RESULT
  // ==========================================================

  return {
    referenceBase: finalPrice,

    minSuggested,

    maxSuggested,

    extras: {
      loadingFee: Number(loadingFee),
      unloadingFee: Number(unloadingFee),
      floorSurcharge: Number(floorSurcharge),
      fragileSurcharge: Number(fragileSurcharge),
    },

    extrasTotal,

    commissionRate: config.commissionRate,

    platformFee: config.platformFee,
  };
};

// ============================================================
// MAXI FINAL FINANCIAL CALCULATION
// ============================================================
//
// This is used AFTER the user and courier have agreed on a
// Maxi offer.
//
// Example:
//
// agreedAmount = ₦50,000
// commissionRate = 18%
// platformFee = ₦400
//
// commission = ₦9,000
// platform service revenue = ₦9,400
// VAT = ₦705
// customer pays = ₦51,105
// courier earns = ₦41,000
//
// The agreed amount is treated as the operational fare.
// ============================================================

export const calculateMaxiFinancials = ({ type, agreedAmount }) => {
  const config = PRICING_CONFIG[type];

  if (!config) {
    return null;
  }

  // ==========================================================
  // VALIDATE AGREED AMOUNT
  // ==========================================================

  const operationalFare = Number(agreedAmount);

  if (!Number.isFinite(operationalFare) || operationalFare <= 0) {
    return null;
  }

  // ==========================================================
  // COMMISSION
  // ==========================================================

  const commissionAmount = operationalFare * config.commissionRate;

  // ==========================================================
  // PLATFORM SERVICE REVENUE
  // ==========================================================
  //
  // Atua's platform service revenue before VAT:
  //
  // commission + platform fee
  // ==========================================================

  const platformServiceRevenue = commissionAmount + config.platformFee;

  // ==========================================================
  // VAT
  // ==========================================================
  //
  // VAT is calculated on Atua's platform service revenue.
  //
  // IMPORTANT:
  // Confirm the exact Nigerian VAT treatment with your
  // accountant/tax adviser before production.
  // ==========================================================

  const vatRate = 0.075;

  const vatAmount = platformServiceRevenue * vatRate;

  // ==========================================================
  // NET PLATFORM REVENUE
  // ==========================================================

  const platformNetRevenue = platformServiceRevenue - vatAmount;

  // ==========================================================
  // COURIER EARNINGS
  // ==========================================================

  const courierEarnings = operationalFare - commissionAmount;

  // ==========================================================
  // CUSTOMER PRICE
  // ==========================================================
  //
  // Customer pays:
  //
  // operational fare
  // + platform fee
  // + VAT
  //
  // The courier's commission is already deducted from the
  // operational fare when calculating courier earnings.
  // ==========================================================

  const customerPrice = operationalFare + config.platformFee + vatAmount;

  // ==========================================================
  // RETURN
  // ==========================================================

  return {
    operationalFare: Math.round(operationalFare),

    commissionAmount: Math.round(commissionAmount),

    commissionRate: config.commissionRate,

    platformFee: Math.round(config.platformFee),

    platformServiceRevenue: Math.round(platformServiceRevenue),

    vatAmount: Math.round(vatAmount),

    platformNetRevenue: Math.round(platformNetRevenue),

    courierEarnings: Math.round(courierEarnings),

    customerPrice: Math.round(customerPrice),
  };
};
