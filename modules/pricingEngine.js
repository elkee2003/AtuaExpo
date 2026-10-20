import { PRICING_CONFIG } from "../config/pricingConfig";

export const pricingEngine = ({ type, distanceKm, date = new Date() }) => {
  const config = PRICING_CONFIG[type];

  if (!config) return null;

  // ======================================================
  // DISTANCE VALIDATION
  // ======================================================
  //
  // Convert distanceKm to a number because it may come
  // from an API, database, or user input as a string.
  //
  // Example:
  //
  // "14.31" → 14.31
  //
  // Reject invalid or negative distances.
  // ======================================================

  const distance = Number(distanceKm);

  if (!Number.isFinite(distance) || distance < 0) {
    return null;
  }

  // ======================================================
  // DISTANCE FARE
  // ======================================================
  //
  // initialFare covers the first 1 km.
  //
  // After 1 km, the remaining distance is charged
  // progressively according to the distance bands.
  //
  // Example:
  //
  // 6.9 km trip:
  //
  //   First 1 km       = initialFare
  //   Km 1 - 3         = 2 km × 1-3 rate
  //   Km 3 - 5         = 2 km × 3-5 rate
  //   Km 5 - 6.9       = 1.9 km × 5-7 rate
  //
  // Therefore, we NEVER charge:
  //
  //   6.9 km × one single rate
  //
  // Instead, each portion of the trip is charged
  // according to the band it falls inside.
  // ======================================================

  let operationalFare = config.initialFare;

  // The initialFare covers 0 - 1 km.
  // Therefore, the first additional band starts at 1 km.
  let previousBandLimit = 1;

  for (const band of config.distanceBands) {
    // Ignore the 0-1 km band because initialFare
    // already covers that distance.
    if (band.upToKm <= 1) {
      continue;
    }

    // How many kilometres of the trip fall inside
    // this particular band?
    //
    // Example:
    // distance = 6.9
    // band = 3 - 5 km
    //
    // kmInBand =
    // Math.min(6.9, 5) - 3
    // = 2 km
    //
    const kmInBand = Math.max(
      0,
      Math.min(distance, band.upToKm) - previousBandLimit,
    );

    operationalFare += kmInBand * band.ratePerKm;

    // We have reached the customer's actual distance.
    if (distance <= band.upToKm) {
      break;
    }

    // Move to the next band.
    previousBandLimit = band.upToKm;
  }

  // Never allow operational fare below minFare.
  if (operationalFare < config.minFare) {
    operationalFare = config.minFare;
  }

  // Round before applying surcharges.
  operationalFare = Math.round(operationalFare);

  // ======================================================
  // TIME / DAY SURCHARGES
  // ======================================================

  const hour = date.getHours();
  const day = date.getDay();

  // Peak: 5 PM - 8 PM
  const isPeak = hour >= 17 && hour <= 20;

  // Night: 10 PM - 5 AM
  const isNight = hour >= 22 || hour < 5;

  // Saturday or Sunday
  const isWeekend = day === 0 || day === 6;

  // Peak surcharge = +10%
  if (isPeak) {
    operationalFare *= 1.1;
  }

  // Night surcharge = +₦300
  if (isNight) {
    operationalFare += 300;
  }

  // Weekend surcharge = +₦250
  if (isWeekend) {
    operationalFare += 250;
  }

  // Round after all operational surcharges.
  operationalFare = Math.round(operationalFare);

  // ======================================================
  // COMMISSION
  // ======================================================

  // Round the commission first so all subsequent
  // financial calculations use the same whole-naira amount.
  const commissionAmount = Math.round(operationalFare * config.commissionRate);

  // ======================================================
  // PLATFORM SERVICE REVENUE
  // ======================================================

  const platformServiceRevenue = commissionAmount + config.platformFee;

  // ======================================================
  // VAT
  // ======================================================

  const vatRate = 0.075;

  const vatAmount = Math.round(platformServiceRevenue * vatRate);

  // ======================================================
  // NET PLATFORM REVENUE
  // ======================================================

  const platformNetRevenue = platformServiceRevenue - vatAmount;

  // ======================================================
  // COURIER EARNINGS
  // ======================================================

  const courierEarnings = operationalFare - commissionAmount;

  // ======================================================
  // CUSTOMER PRICE
  // ======================================================

  const customerPrice = operationalFare + config.platformFee + vatAmount;

  // ======================================================
  // RETURN PRICING BREAKDOWN
  // ======================================================

  return {
    operationalFare,

    commissionAmount,
    commissionRate: config.commissionRate,

    platformFee: config.platformFee,

    platformServiceRevenue,

    vatAmount,

    platformNetRevenue: Math.round(platformNetRevenue),

    courierEarnings: Math.round(courierEarnings),

    customerPrice: Math.round(customerPrice),
  };
};
