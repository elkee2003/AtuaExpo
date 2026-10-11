import { PRICING_CONFIG } from "../config/pricingConfig";

/**
 * ============================================================
 * FREIGHT PRICING ENGINE
 * ============================================================
 *
 * Used for Maxi / Freight vehicle pricing.
 *
 * The pricing model is progressive:
 *
 *   - initialFare covers the first 1 km
 *   - each distance band charges ONLY the kilometres
 *     that fall inside that particular band
 *
 * Example:
 *
 *   initialFare = ₦2,000
 *
 *   0–1 km   → ₦2,000
 *   1–3 km   → ₦450/km
 *   3–5 km   → ₦550/km
 *   5–7 km   → ₦500/km
 *
 * A 6.9 km trip is therefore:
 *
 *   ₦2,000
 *   + (2 km × ₦450)
 *   + (2 km × ₦550)
 *   + (1.9 km × ₦500)
 *
 *   = ₦4,950
 *
 * The result is then adjusted for:
 *   - load category
 *   - interstate delivery
 *   - loading/unloading/floor/fragile extras
 *
 * Finally, we provide a negotiation range:
 *
 *   minimum = 40% below reference price
 *   maximum = 50% above reference price
 *
 * So a ₦50,000 reference price becomes:
 *
 *   ₦30,000 – ₦75,000
 *
 * IMPORTANT:
 * This function calculates a REFERENCE PRICE and
 * NEGOTIATION RANGE.
 *
 * It does NOT calculate the final courier earnings.
 *
 * Once the customer and courier agree on an amount,
 * calculateMaxiFinancials() should be used to calculate:
 *
 *   - commission
 *   - platform fee
 *   - VAT
 *   - courier earnings
 *   - customer price
 * ============================================================
 */

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
  // ------------------------------------------------------------
  // 1. Get the pricing configuration for the vehicle type
  // ------------------------------------------------------------

  const config = PRICING_CONFIG[type];

  if (!config) {
    return null;
  }

  // ------------------------------------------------------------
  // 2. Validate distance
  // ------------------------------------------------------------

  const distance = Number(distanceKm);

  if (!Number.isFinite(distance) || distance < 0) {
    return null;
  }

  // ------------------------------------------------------------
  // 3. Calculate the progressive distance fare
  // ------------------------------------------------------------
  //
  // initialFare covers 0–1 km.
  //
  // We therefore start with initialFare and begin
  // calculating additional kilometres from 1 km onward.
  // ------------------------------------------------------------

  let base = config.initialFare;

  // The first band has already been covered by initialFare.
  // Therefore, the next calculation starts at 1 km.
  let previousBandLimit = 1;

  // Go through each progressive distance band.
  for (const band of config.distanceBands) {
    // Skip the 0–1 km band because initialFare
    // already covers that distance.
    if (band.upToKm <= 1) {
      continue;
    }

    // ----------------------------------------------------------
    // Calculate how many kilometres fall inside this band.
    //
    // Example:
    //
    // Distance = 6.9 km
    //
    // Current band = 5–7 km
    //
    // kilometres in band:
    //
    // min(6.9, 7) - 5
    // = 1.9 km
    // ----------------------------------------------------------

    const kmInBand = Math.max(
      0,
      Math.min(distance, band.upToKm) - previousBandLimit,
    );

    // Add only the kilometres that actually belong
    // to this band.
    base += kmInBand * band.ratePerKm;

    // ----------------------------------------------------------
    // If the destination is inside this band, we are finished.
    // There is no need to calculate later bands.
    // ----------------------------------------------------------

    if (distance <= band.upToKm) {
      break;
    }

    // Move the starting point to the end of this band
    // before processing the next band.
    previousBandLimit = band.upToKm;
  }

  // ------------------------------------------------------------
  // 4. Apply minimum fare
  // ------------------------------------------------------------
  //
  // This protects short/cheap trips from becoming too cheap.
  //
  // Example:
  //
  // calculated fare = ₦1,800
  // minFare = ₦2,000
  //
  // final base becomes ₦2,000.
  // ------------------------------------------------------------

  if (base < config.minFare) {
    base = config.minFare;
  }

  // ------------------------------------------------------------
  // 5. Apply load-category adjustments
  // ------------------------------------------------------------
  //
  // BUILDING_MATERIAL:
  //     +15%
  //
  // FRAGILE:
  //     +20%
  //
  // These are percentage adjustments to the calculated
  // distance/base fare.
  // ------------------------------------------------------------

  if (loadCategory === "BUILDING_MATERIAL") {
    base *= 1.15;
  }

  if (loadCategory === "FRAGILE") {
    base *= 1.2;
  }

  // ------------------------------------------------------------
  // 6. Apply interstate adjustment
  // ------------------------------------------------------------
  //
  // Interstate freight gets a +25% adjustment.
  // ------------------------------------------------------------

  if (isInterState) {
    base *= 1.25;
  }

  // ------------------------------------------------------------
  // 7. Calculate additional service charges
  // ------------------------------------------------------------
  //
  // These are separate from the distance fare.
  //
  // loadingFee
  // unloadingFee
  // floorSurcharge
  // fragileSurcharge
  //
  // Example:
  //
  // loadingFee       = ₦500
  // unloadingFee     = ₦500
  // floorSurcharge   = ₦300
  // fragileSurcharge = ₦500
  //
  // extrasTotal      = ₦1,800
  // ------------------------------------------------------------

  const extrasTotal =
    Number(loadingFee) +
    Number(unloadingFee) +
    Number(floorSurcharge) +
    Number(fragileSurcharge);

  // Make sure the extra charges are valid numbers.
  if (!Number.isFinite(extrasTotal)) {
    return null;
  }

  // ------------------------------------------------------------
  // 8. Calculate the final reference price
  // ------------------------------------------------------------
  //
  // Reference price =
  //
  // adjusted distance/base fare
  // + additional service charges
  //
  // We round it to the nearest whole Naira.
  // ------------------------------------------------------------

  const finalPrice = Math.round(base + extrasTotal);

  // ------------------------------------------------------------
  // 9. Calculate negotiation range
  // ------------------------------------------------------------
  //
  // We intentionally give a wide negotiation window:
  //
  // MINIMUM:
  //     40% BELOW reference
  //
  //     reference × 0.60
  //
  // MAXIMUM:
  //     50% ABOVE reference
  //
  //     reference × 1.50
  //
  // Example:
  //
  // Reference = ₦50,000
  //
  // Minimum = ₦50,000 × 0.60
  //         = ₦30,000
  //
  // Maximum = ₦50,000 × 1.50
  //         = ₦75,000
  //
  // Negotiation range:
  //
  //     ₦30,000 – ₦75,000
  // ------------------------------------------------------------

  const minSuggested = Math.round(finalPrice * 0.6);

  const maxSuggested = Math.round(finalPrice * 1.5);

  // ------------------------------------------------------------
  // 10. Return the pricing result
  // ------------------------------------------------------------
  //
  // Keep the existing fields so existing parts of the
  // application can continue using the result.
  // ------------------------------------------------------------

  return {
    // Reference price before negotiation
    referenceBase: finalPrice,

    // Suggested negotiation range
    minSuggested,
    maxSuggested,

    // Individual extras
    extras: {
      loadingFee: Number(loadingFee),
      unloadingFee: Number(unloadingFee),
      floorSurcharge: Number(floorSurcharge),
      fragileSurcharge: Number(fragileSurcharge),
    },

    // Total of all additional charges
    extrasTotal,

    // Financial configuration needed later when
    // calculating the agreed amount
    commissionRate: config.commissionRate,
    platformFee: config.platformFee,
  };
};

/**
 * ============================================================
 * MAXI FINAL FINANCIAL CALCULATION
 * ============================================================
 *
 * This function is used AFTER the customer and courier
 * have agreed on a Maxi offer.
 *
 * The agreed amount becomes the operational fare.
 *
 * Example:
 *
 *   agreedAmount = ₦50,000
 *   commissionRate = 18%
 *   platformFee = ₦400
 *
 *   commission:
 *       ₦50,000 × 18%
 *       = ₦9,000
 *
 *   platform service revenue:
 *       ₦9,000 + ₦400
 *       = ₦9,400
 *
 *   VAT:
 *       ₦9,400 × 7.5%
 *       = ₦705
 *
 *   customer pays:
 *       ₦50,000 + ₦400 + ₦705
 *       = ₦51,105
 *
 *   courier earns:
 *       ₦50,000 - ₦9,000
 *       = ₦41,000
 *
 * IMPORTANT:
 *
 * This function is intentionally separate from
 * freightPricingEngine().
 *
 * freightPricingEngine()
 *     → calculates the reference price and bidding range.
 *
 * calculateMaxiFinancials()
 *     → calculates the actual financial breakdown after
 *       the negotiated price has been accepted.
 *
 * The negotiated/agreed amount is treated as the
 * operational fare.
 * ============================================================
 */

export const calculateMaxiFinancials = ({ type, agreedAmount }) => {
  // ------------------------------------------------------------
  // 1. Get the pricing configuration for the vehicle type
  // ------------------------------------------------------------

  const config = PRICING_CONFIG[type];

  if (!config) {
    return null;
  }

  // ------------------------------------------------------------
  // 2. Validate the agreed amount
  // ------------------------------------------------------------
  //
  // The agreed amount comes from the final accepted
  // user/courier negotiation.
  //
  // It must be a valid positive number.
  // ------------------------------------------------------------

  const operationalFare = Number(agreedAmount);

  if (!Number.isFinite(operationalFare) || operationalFare <= 0) {
    return null;
  }

  // ------------------------------------------------------------
  // 3. Calculate Atua commission
  // ------------------------------------------------------------
  //
  // Commission is calculated from the agreed operational fare.
  //
  // Example:
  //
  // operationalFare = ₦50,000
  // commissionRate  = 18%
  //
  // commission = ₦9,000
  // ------------------------------------------------------------

  const commissionAmount = operationalFare * config.commissionRate;

  // ------------------------------------------------------------
  // 4. Calculate platform service revenue
  // ------------------------------------------------------------
  //
  // Atua's platform service revenue before VAT consists of:
  //
  //     commission
  //     +
  //     platform fee
  //
  // Example:
  //
  // commission   = ₦9,000
  // platform fee = ₦400
  //
  // platform service revenue = ₦9,400
  // ------------------------------------------------------------

  const platformServiceRevenue = commissionAmount + config.platformFee;

  // ------------------------------------------------------------
  // 5. Calculate VAT
  // ------------------------------------------------------------
  //
  // VAT is calculated on Atua's platform service revenue.
  //
  // IMPORTANT:
  // Confirm the exact Nigerian VAT treatment with your
  // accountant/tax adviser before production.
  // ------------------------------------------------------------

  const vatRate = 0.075;

  const vatAmount = platformServiceRevenue * vatRate;

  // ------------------------------------------------------------
  // 6. Calculate net platform revenue
  // ------------------------------------------------------------
  //
  // This is Atua's platform service revenue after
  // deducting the VAT amount.
  // ------------------------------------------------------------

  const platformNetRevenue = platformServiceRevenue - vatAmount;

  // ------------------------------------------------------------
  // 7. Calculate courier earnings
  // ------------------------------------------------------------
  //
  // Courier earnings are the agreed operational fare
  // minus Atua's commission.
  //
  // Example:
  //
  // operational fare = ₦50,000
  // commission       = ₦9,000
  //
  // courier earnings = ₦41,000
  // ------------------------------------------------------------

  const courierEarnings = operationalFare - commissionAmount;

  // ------------------------------------------------------------
  // 8. Calculate customer price
  // ------------------------------------------------------------
  //
  // Customer pays:
  //
  //     operational fare
  //     + platform fee
  //     + VAT
  //
  // The commission is NOT added again here because it is
  // already deducted from the operational fare when we
  // calculate courier earnings.
  //
  // Example:
  //
  // operational fare = ₦50,000
  // platform fee     = ₦400
  // VAT              = ₦705
  //
  // customer price   = ₦51,105
  // ------------------------------------------------------------

  const customerPrice = operationalFare + config.platformFee + vatAmount;

  // ------------------------------------------------------------
  // 9. Return the complete financial breakdown
  // ------------------------------------------------------------
  //
  // These fields are expected by the order acceptance flow.
  // ------------------------------------------------------------

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
