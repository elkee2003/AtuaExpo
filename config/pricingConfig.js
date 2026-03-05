export const PRICING_CONFIG = {
  // MICRO
  MICRO_BATCH: {
    baseFare: 250,
    perKm: 150,
    minFare: 600,
    commissionRate: 0.15,
    platformFee: 200,
  },
  MICRO_EXPRESS: {
    baseFare: 300,
    perKm: 170,
    minFare: 700,
    commissionRate: 0.15,
    platformFee: 250,
  },

  // MOTO
  MOTO_BATCH: {
    baseFare: 400,
    perKm: 200,
    minFare: 900,
    commissionRate: 0.18,
    platformFee: 300,
  },
  MOTO_EXPRESS: {
    baseFare: 500,
    perKm: 220,
    minFare: 1100,
    commissionRate: 0.18,
    platformFee: 350,
  },

  // VANS
  SMALL_VAN: {
    baseFare: 3000,
    perKm: 600,
    minFare: 8000,
    commissionRate: 0.2,
    platformFee: 800,

    fuelConsumptionPerKm: 0.18,
    maintenanceCostPerKm: 150,
  },
  MEDIUM_VAN: {
    baseFare: 5000,
    perKm: 850,
    minFare: 12000,
    commissionRate: 0.22,
    platformFee: 1200,

    fuelConsumptionPerKm: 0.22,
    maintenanceCostPerKm: 220,
  },
  LARGE_VAN: {
    baseFare: 7000,
    perKm: 1100,
    minFare: 16000,
    commissionRate: 0.23,
    platformFee: 1500,

    fuelConsumptionPerKm: 0.28,
    maintenanceCostPerKm: 300,
  },

  // BOX TRUCKS
  TRUCK_5T: {
    baseFare: 12000,
    perKm: 1600,
    minFare: 30000,
    commissionRate: 0.25,
    platformFee: 2000,

    fuelConsumptionPerKm: 0.32,
    maintenanceCostPerKm: 450,
  },
  TRUCK_10T: {
    baseFare: 20000,
    perKm: 2200,
    minFare: 45000,
    commissionRate: 0.27,
    platformFee: 3000,

    fuelConsumptionPerKm: 0.4,
    maintenanceCostPerKm: 650,
  },
  // TRUCK_20T: {
  //     baseFare: 12000,
  //     perKm: 1600,
  //     minFare: 25000,
  //     commissionRate: 0.30,
  //     platformFee: 2500
  // },

  // FLATBEDS
  FLATBED_5T: {
    baseFare: 18000,
    perKm: 2200,
    minFare: 40000,
    commissionRate: 0.26,
    platformFee: 3000,

    fuelConsumptionPerKm: 0.35,
    maintenanceCostPerKm: 500,
  },
  FLATBED_10T: {
    baseFare: 30000,
    perKm: 3200,
    minFare: 75000,
    commissionRate: 0.28,
    platformFee: 5000,

    fuelConsumptionPerKm: 0.45,
    maintenanceCostPerKm: 750,
  },
  // FLATBED_20T: {
  //     baseFare: 15000,
  //     perKm: 2000,
  //     minFare: 30000,
  //     commissionRate: 0.30,
  //     platformFee: 3000
  // },

  // TIPPERS (usually higher wear & risk)
  TIPPER_5T: {
    baseFare: 20000,
    perKm: 2400,
    minFare: 45000,
    commissionRate: 0.27,
    platformFee: 3500,

    fuelConsumptionPerKm: 0.38,
    maintenanceCostPerKm: 600,
  },
  TIPPER_10T: {
    baseFare: 35000,
    perKm: 3500,
    minFare: 90000,
    commissionRate: 0.3,
    platformFee: 6000,

    fuelConsumptionPerKm: 0.5,
    maintenanceCostPerKm: 900,
  },
  // TIPPER_20T: {
  //     baseFare: 18000, perKm: 2300, minFare: 35000, commissionRate: 0.32, platformFee: 4000
  // },

  // REFRIGERATED
  REFRIGERATED_5T: {
    baseFare: 25000,
    perKm: 3000,
    minFare: 60000,
    commissionRate: 0.28,
    platformFee: 4000,

    fuelConsumptionPerKm: 0.42,
    maintenanceCostPerKm: 700,
  },
  REFRIGERATED_10T: {
    baseFare: 40000,
    perKm: 4200,
    minFare: 100000,
    commissionRate: 0.3,
    platformFee: 7000,

    fuelConsumptionPerKm: 0.55,
    maintenanceCostPerKm: 1100,
  },
};
