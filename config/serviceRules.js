import { TRANSPORT_TYPES } from "../constants/transportTypes";

export const SERVICE_RULES = {
  [TRANSPORT_TYPES.MICRO_EXPRESS]: {
    maxDistanceKm: 13,
    category: "INSTANT",
  },
  [TRANSPORT_TYPES.MICRO_BATCH]: {
    maxDistanceKm: 13,
    category: "BATCH",
  },
  [TRANSPORT_TYPES.MOTO_EXPRESS]: {
    maxDistanceKm: null,
    category: "INSTANT",
  },
  [TRANSPORT_TYPES.MOTO_BATCH]: {
    maxDistanceKm: null,
    category: "BATCH",
  },
  [TRANSPORT_TYPES.MAXI]: {
    maxDistanceKm: null,
    category: "MAXI",
  },
};
