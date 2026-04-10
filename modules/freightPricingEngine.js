import { MARKET_CONFIG } from "../config/marketConfig";
import { PRICING_CONFIG } from "../config/pricingConfig";

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
  if (!config) return null;

  // ---------------- BASE DISTANCE COST ----------------
  let base = config.baseFare + distanceKm * config.perKm;

  // ---------------- ADD FUEL & MAINTENANCE FOR MAXI ----------------
  if (config.fuelConsumptionPerKm && config.maintenanceCostPerKm) {
    const fuelCost =
      distanceKm *
      config.fuelConsumptionPerKm *
      MARKET_CONFIG.fuelPricePerLitre;

    const maintenanceCost = distanceKm * config.maintenanceCostPerKm;

    base += fuelCost + maintenanceCost;
  }

  // ---------------- MINIMUM FARE ----------------
  if (base < config.minFare) {
    base = config.minFare;
  }

  // ---------------- LOAD CATEGORY SURCHARGE ----------------
  if (loadCategory === "BUILDING_MATERIAL") {
    base *= 1.1;
  }

  if (loadCategory === "FRAGILE") {
    base *= 1.08;
  }

  // ---------------- INTERSTATE SURCHARGE ----------------
  if (isInterState) {
    base *= 1.12;
  }

  // ---------------- EXTRAS ----------------
  const extrasTotal =
    loadingFee + unloadingFee + floorSurcharge + fragileSurcharge;

  const finalPrice = Math.round(base + extrasTotal);

  return {
    referenceBase: finalPrice,
    minSuggested: Math.round(finalPrice * 0.95),
    maxSuggested: Math.round(finalPrice * 1.15),
    extras: {
      loadingFee,
      unloadingFee,
      floorSurcharge,
      fragileSurcharge,
    },
    extrasTotal,
    commissionRate: config.commissionRate,
    platformFee: config.platformFee,
  };
};
