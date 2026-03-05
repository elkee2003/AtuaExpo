import { SERVICE_RULES } from "../config/serviceRules";

export const getAvailableServices = (distanceKm) => {
  return Object.entries(SERVICE_RULES)
    .filter(([_, rules]) => {
      if (!rules.maxDistanceKm) return true;
      return distanceKm <= rules.maxDistanceKm;
    })
    .map(([type]) => type);
};
