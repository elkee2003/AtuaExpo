export const PRICING_CONFIG = {
  MOTO_BATCH: {
    minFare: 1485,
    commissionRate: 0.15,
    platformFee: 250,
    initialFare: 1485,

    distanceBands: [
      { upToKm: 1, ratePerKm: 0 },
      { upToKm: 2, ratePerKm: 238 },
      { upToKm: 3, ratePerKm: 248 },
      { upToKm: 5, ratePerKm: 382 },
      { upToKm: 7, ratePerKm: 212 },
      { upToKm: 10, ratePerKm: 176 },
      { upToKm: 15, ratePerKm: 135 },
      { upToKm: 20, ratePerKm: 99 },
      { upToKm: 30, ratePerKm: 99 },
      { upToKm: Infinity, ratePerKm: 99 },
    ],
  },

  MICRO_BATCH: {
    minFare: 1260,
    commissionRate: 0.15,
    platformFee: 200,
    initialFare: 1260,

    distanceBands: [
      { upToKm: 1, ratePerKm: 0 },
      { upToKm: 2, ratePerKm: 126 },
      { upToKm: 3, ratePerKm: 180 },
      { upToKm: 5, ratePerKm: 338 },
      { upToKm: 7, ratePerKm: 166 },
      { upToKm: 10, ratePerKm: 153 },
      { upToKm: 15, ratePerKm: 135 },
      { upToKm: 20, ratePerKm: 99 },
      { upToKm: 30, ratePerKm: 99 },
      { upToKm: Infinity, ratePerKm: 99 },
    ],
  },

  MICRO_EXPRESS: {
    minFare: 1513,
    commissionRate: 0.15,
    platformFee: 250,
    initialFare: 1513,

    distanceBands: [
      { upToKm: 1, ratePerKm: 0 },
      { upToKm: 2, ratePerKm: 237 },
      { upToKm: 3, ratePerKm: 260 },
      { upToKm: 5, ratePerKm: 496 },
      { upToKm: 7, ratePerKm: 260 },
      { upToKm: 10, ratePerKm: 194 },
      { upToKm: 15, ratePerKm: 151 },
      { upToKm: 20, ratePerKm: 113 },
      { upToKm: 30, ratePerKm: 113 },
      { upToKm: Infinity, ratePerKm: 113 },
    ],
  },

  MOTO_EXPRESS: {
    minFare: 1844,
    commissionRate: 0.15,
    platformFee: 280,
    initialFare: 1844,

    distanceBands: [
      { upToKm: 1, ratePerKm: 0 },
      { upToKm: 2, ratePerKm: 355 },
      { upToKm: 3, ratePerKm: 378 },
      { upToKm: 5, ratePerKm: 615 },
      { upToKm: 7, ratePerKm: 355 },
      { upToKm: 10, ratePerKm: 284 },
      { upToKm: 15, ratePerKm: 194 },
      { upToKm: 20, ratePerKm: 151 },
      { upToKm: 30, ratePerKm: 151 },
      { upToKm: Infinity, ratePerKm: 151 },
    ],
  },

  // ============================================================
  // MAXI SECTION
  // ============================================================

  CAR: {
    minFare: 8000,
    initialFare: 8000,
    commissionRate: 0.15,
    platformFee: 350,
    distanceBands: [
      { upToKm: 3, ratePerKm: 300 },
      { upToKm: 5, ratePerKm: 350 },
      { upToKm: 7, ratePerKm: 325 },
      { upToKm: 10, ratePerKm: 300 },
      { upToKm: 15, ratePerKm: 285 },
      { upToKm: Infinity, ratePerKm: 250 },
    ],
  },

  WAGON: {
    minFare: 9500,
    initialFare: 9500,
    commissionRate: 0.16,
    platformFee: 400,
    distanceBands: [
      { upToKm: 3, ratePerKm: 340 },
      { upToKm: 5, ratePerKm: 390 },
      { upToKm: 7, ratePerKm: 370 },
      { upToKm: 10, ratePerKm: 345 },
      { upToKm: 15, ratePerKm: 325 },
      { upToKm: Infinity, ratePerKm: 280 },
    ],
  },

  MINIBUS: {
    minFare: 11500,
    initialFare: 11500,
    commissionRate: 0.17,
    platformFee: 450,
    distanceBands: [
      { upToKm: 3, ratePerKm: 400 },
      { upToKm: 5, ratePerKm: 450 },
      { upToKm: 7, ratePerKm: 425 },
      { upToKm: 10, ratePerKm: 400 },
      { upToKm: 15, ratePerKm: 380 },
      { upToKm: Infinity, ratePerKm: 300 },
    ],
  },

  PICKUP: {
    minFare: 13200,
    initialFare: 13200,
    commissionRate: 0.18,
    platformFee: 550,
    distanceBands: [
      { upToKm: 3, ratePerKm: 910 },
      { upToKm: 5, ratePerKm: 1030 },
      { upToKm: 7, ratePerKm: 925 },
      { upToKm: 10, ratePerKm: 885 },
      { upToKm: 15, ratePerKm: 870 },
      { upToKm: Infinity, ratePerKm: 550 },
    ],
  },

  SMALL_VAN: {
    minFare: 18000,
    initialFare: 18000,
    commissionRate: 0.2,
    platformFee: 770,
    distanceBands: [
      { upToKm: 3, ratePerKm: 455 },
      { upToKm: 5, ratePerKm: 515 },
      { upToKm: 7, ratePerKm: 500 },
      { upToKm: 10, ratePerKm: 710 },
      { upToKm: 15, ratePerKm: 820 },
      { upToKm: Infinity, ratePerKm: 330 },
    ],
  },

  MEDIUM_VAN: {
    minFare: 22000,
    initialFare: 22000,
    commissionRate: 0.2,
    platformFee: 850,
    distanceBands: [
      { upToKm: 3, ratePerKm: 500 },
      { upToKm: 5, ratePerKm: 560 },
      { upToKm: 7, ratePerKm: 540 },
      { upToKm: 10, ratePerKm: 760 },
      { upToKm: 15, ratePerKm: 880 },
      { upToKm: Infinity, ratePerKm: 350 },
    ],
  },

  LARGE_VAN: {
    minFare: 27000,
    initialFare: 27000,
    commissionRate: 0.21,
    platformFee: 950,
    distanceBands: [
      { upToKm: 3, ratePerKm: 560 },
      { upToKm: 5, ratePerKm: 620 },
      { upToKm: 7, ratePerKm: 600 },
      { upToKm: 10, ratePerKm: 820 },
      { upToKm: 15, ratePerKm: 950 },
      { upToKm: Infinity, ratePerKm: 380 },
    ],
  },

  TRUCK_5T: {
    minFare: 35000,
    initialFare: 35000,
    commissionRate: 0.22,
    platformFee: 1100,
    distanceBands: [
      { upToKm: 3, ratePerKm: 700 },
      { upToKm: 5, ratePerKm: 780 },
      { upToKm: 7, ratePerKm: 750 },
      { upToKm: 10, ratePerKm: 1000 },
      { upToKm: 15, ratePerKm: 1150 },
      { upToKm: Infinity, ratePerKm: 450 },
    ],
  },

  FLATBED_5T: {
    minFare: 38000,
    initialFare: 38000,
    commissionRate: 0.22,
    platformFee: 1150,
    distanceBands: [
      { upToKm: 3, ratePerKm: 730 },
      { upToKm: 5, ratePerKm: 820 },
      { upToKm: 7, ratePerKm: 790 },
      { upToKm: 10, ratePerKm: 1050 },
      { upToKm: 15, ratePerKm: 1200 },
      { upToKm: Infinity, ratePerKm: 470 },
    ],
  },

  TIPPER_5T: {
    minFare: 40000,
    initialFare: 40000,
    commissionRate: 0.22,
    platformFee: 1200,
    distanceBands: [
      { upToKm: 3, ratePerKm: 750 },
      { upToKm: 5, ratePerKm: 850 },
      { upToKm: 7, ratePerKm: 820 },
      { upToKm: 10, ratePerKm: 1080 },
      { upToKm: 15, ratePerKm: 1250 },
      { upToKm: Infinity, ratePerKm: 480 },
    ],
  },

  TRUCK_10T: {
    minFare: 48000,
    initialFare: 48000,
    commissionRate: 0.23,
    platformFee: 1400,
    distanceBands: [
      { upToKm: 3, ratePerKm: 850 },
      { upToKm: 5, ratePerKm: 950 },
      { upToKm: 7, ratePerKm: 920 },
      { upToKm: 10, ratePerKm: 1200 },
      { upToKm: 15, ratePerKm: 1400 },
      { upToKm: Infinity, ratePerKm: 550 },
    ],
  },

  FLATBED_10T: {
    minFare: 52000,
    initialFare: 52000,
    commissionRate: 0.23,
    platformFee: 1500,
    distanceBands: [
      { upToKm: 3, ratePerKm: 880 },
      { upToKm: 5, ratePerKm: 990 },
      { upToKm: 7, ratePerKm: 960 },
      { upToKm: 10, ratePerKm: 1250 },
      { upToKm: 15, ratePerKm: 1450 },
      { upToKm: Infinity, ratePerKm: 570 },
    ],
  },

  TIPPER_10T: {
    minFare: 55000,
    initialFare: 55000,
    commissionRate: 0.23,
    platformFee: 1550,
    distanceBands: [
      { upToKm: 3, ratePerKm: 900 },
      { upToKm: 5, ratePerKm: 1020 },
      { upToKm: 7, ratePerKm: 990 },
      { upToKm: 10, ratePerKm: 1300 },
      { upToKm: 15, ratePerKm: 1500 },
      { upToKm: Infinity, ratePerKm: 590 },
    ],
  },

  REFRIGERATED_5T: {
    minFare: 45000,
    initialFare: 45000,
    commissionRate: 0.23,
    platformFee: 1300,
    distanceBands: [
      { upToKm: 3, ratePerKm: 800 },
      { upToKm: 5, ratePerKm: 900 },
      { upToKm: 7, ratePerKm: 870 },
      { upToKm: 10, ratePerKm: 1150 },
      { upToKm: 15, ratePerKm: 1350 },
      { upToKm: Infinity, ratePerKm: 520 },
    ],
  },

  REFRIGERATED_10T: {
    minFare: 60000,
    initialFare: 60000,
    commissionRate: 0.24,
    platformFee: 1700,
    distanceBands: [
      { upToKm: 3, ratePerKm: 950 },
      { upToKm: 5, ratePerKm: 1080 },
      { upToKm: 7, ratePerKm: 1050 },
      { upToKm: 10, ratePerKm: 1400 },
      { upToKm: 15, ratePerKm: 1650 },
      { upToKm: Infinity, ratePerKm: 650 },
    ],
  },
};

// export const PRICING_CONFIG = {
//

//   CAR: {
//     baseFare: 800,
//     perKm: 700,
//     minFare: 2000,
//     commissionRate: 0.18,
//     platformFee: 400,
//   },

//   WAGON: {
//     baseFare: 1000,
//     perKm: 750,
//     minFare: 2500,
//     commissionRate: 0.18,
//     platformFee: 400,
//   },

//   MINIBUS: {
//     baseFare: 1200,
//     perKm: 900,
//     minFare: 3500,
//     commissionRate: 0.18,
//     platformFee: 500,
//   },

//   // PICKUP
//   PICKUP: {
//     baseFare: 1500,
//     perKm: 1000,
//     minFare: 3500,
//     commissionRate: 0.18,
//     platformFee: 500,
//   },

//   // VANS
//   SMALL_VAN: {
//     baseFare: 3000,
//     perKm: 300,
//     minFare: 8000,
//     commissionRate: 0.2,
//     platformFee: 800,
//   },
//   MEDIUM_VAN: {
//     baseFare: 5000,
//     perKm: 350,
//     minFare: 12000,
//     commissionRate: 0.22,
//     platformFee: 1200,
//   },
//   LARGE_VAN: {
//     baseFare: 7000,
//     perKm: 350,
//     minFare: 16000,
//     commissionRate: 0.23,
//     platformFee: 1500,
//   },

//   // BOX TRUCKS
//   TRUCK_5T: {
//     baseFare: 12000,
//     perKm: 400,
//     minFare: 30000,
//     commissionRate: 0.25,
//     platformFee: 2000,
//   },
//   TRUCK_10T: {
//     baseFare: 20000,
//     perKm: 600,
//     minFare: 45000,
//     commissionRate: 0.27,
//     platformFee: 3000,
//   },
//   // TRUCK_20T: {
//   //     baseFare: 12000,
//   //     perKm: 1600,
//   //     minFare: 25000,
//   //     commissionRate: 0.30,
//   //     platformFee: 2500
//   // },

//   // FLATBEDS
//   FLATBED_5T: {
//     baseFare: 18000,
//     perKm: 400,
//     minFare: 40000,
//     commissionRate: 0.26,
//     platformFee: 3000,
//   },
//   FLATBED_10T: {
//     baseFare: 30000,
//     perKm: 500,
//     minFare: 50000,
//     commissionRate: 0.28,
//     platformFee: 5000,
//   },
//   // FLATBED_20T: {
//   //     baseFare: 15000,
//   //     perKm: 2000,
//   //     minFare: 30000,
//   //     commissionRate: 0.30,
//   //     platformFee: 3000
//   // },

//   // TIPPERS (usually higher wear & risk)
//   TIPPER_5T: {
//     baseFare: 20000,
//     perKm: 450,
//     minFare: 45000,
//     commissionRate: 0.27,
//     platformFee: 3500,
//   },
//   TIPPER_10T: {
//     baseFare: 35000,
//     perKm: 550,
//     minFare: 90000,
//     commissionRate: 0.3,
//     platformFee: 6000,
//   },
//   // TIPPER_20T: {
//   //     baseFare: 18000, perKm: 2300, minFare: 35000, commissionRate: 0.32, platformFee: 4000
//   // },

//   // REFRIGERATED
//   REFRIGERATED_5T: {
//     baseFare: 25000,
//     perKm: 500,
//     minFare: 60000,
//     commissionRate: 0.28,
//     platformFee: 4000,
//   },
//   REFRIGERATED_10T: {
//     baseFare: 40000,
//     perKm: 4200,
//     minFare: 100000,
//     commissionRate: 0.3,
//     platformFee: 7000,
//   },
// };
