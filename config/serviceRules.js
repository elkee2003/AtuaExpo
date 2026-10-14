import { TRANSPORT_TYPES } from "../constants/transportTypes";

export const SERVICE_RULES = {
  [TRANSPORT_TYPES.MICRO_EXPRESS]: {
    maxDistanceKm: 9,
    maxCourierPickupDistanceKm: 3,
    category: "INSTANT",
  },

  [TRANSPORT_TYPES.MICRO_BATCH]: {
    maxDistanceKm: 9,
    maxCourierPickupDistanceKm: 5,
    category: "BATCH",
  },

  [TRANSPORT_TYPES.MOTO_EXPRESS]: {
    maxDistanceKm: null,
    maxCourierPickupDistanceKm: null,
    category: "INSTANT",
  },

  [TRANSPORT_TYPES.MOTO_BATCH]: {
    maxDistanceKm: null,
    maxCourierPickupDistanceKm: null,
    category: "BATCH",
  },

  [TRANSPORT_TYPES.MAXI]: {
    maxDistanceKm: null,
    maxCourierPickupDistanceKm: null,
    category: "MAXI",
  },
};
