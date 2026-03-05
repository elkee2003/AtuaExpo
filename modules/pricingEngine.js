import { PRICING_CONFIG } from "../config/pricingConfig";

export const pricingEngine = ({ type, distanceKm, date = new Date() }) => {
  const config = PRICING_CONFIG[type];
  if (!config) return null;

  // ---------------- BASE FARE ----------------
  let operationalFare = config.baseFare + distanceKm * config.perKm;

  if (operationalFare < config.minFare) {
    operationalFare = config.minFare;
  }

  // ---------------- TIME SURGE ----------------
  const hour = date.getHours();
  const day = date.getDay();

  const isPeak = hour >= 17 && hour <= 20;
  const isNight = hour >= 22 || hour < 5;
  const isWeekend = day === 0 || day === 6;

  if (isPeak) operationalFare *= 1.15;
  if (isNight) operationalFare += 200;
  if (isWeekend) operationalFare += 100;

  operationalFare = Math.round(operationalFare);

  // ---------------- COMMISSION ----------------
  const commissionAmount = operationalFare * config.commissionRate;

  // ---------------- PLATFORM SERVICE REVENUE ----------------
  const platformServiceRevenue = Math.round(
    commissionAmount + config.platformFee,
  );

  // ---------------- VAT (on platform service only) ----------------
  const vatRate = 0.075; // 7.5%
  const vatAmount = Math.round(platformServiceRevenue * vatRate);

  // ---------------- NET PLATFORM REVENUE ----------------
  const platformNetRevenue = platformServiceRevenue - vatAmount;

  // ---------------- COURIER EARNINGS ----------------
  const courierEarnings = operationalFare - commissionAmount;

  // ---------------- CUSTOMER PRICE ----------------
  const customerPrice = operationalFare + config.platformFee + vatAmount;

  return {
    operationalFare,
    commissionAmount: Math.round(commissionAmount),
    commissionRate: config.commissionRate,
    platformFee: config.platformFee,
    platformServiceRevenue: Math.round(platformServiceRevenue),
    vatAmount,
    platformNetRevenue: Math.round(platformNetRevenue),
    courierEarnings: Math.round(courierEarnings),
    customerPrice: Math.round(customerPrice),
  };
};
