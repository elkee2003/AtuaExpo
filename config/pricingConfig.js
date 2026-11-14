export const PRICING_CONFIG = {
  MOTO_BATCH: {
    minFare: 1485,
    commissionRate: 0.15,
    platformFee: 280,
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
    platformFee: 220,
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
    platformFee: 280,
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
    minFare: 1815,
    commissionRate: 0.15,
    platformFee: 300,
    initialFare: 1815,

    distanceBands: [
      { upToKm: 1, ratePerKm: 0 },
      { upToKm: 2, ratePerKm: 350 },
      { upToKm: 3, ratePerKm: 372 },
      { upToKm: 5, ratePerKm: 606 },
      { upToKm: 7, ratePerKm: 350 },
      { upToKm: 10, ratePerKm: 279 },
      { upToKm: 15, ratePerKm: 190 },
      { upToKm: 20, ratePerKm: 149 },
      { upToKm: 30, ratePerKm: 149 },
      { upToKm: Infinity, ratePerKm: 149 },
    ],
  },

  // ============================================================
  // MAXI SECTION
  // ============================================================

  CAR: {
    minFare: 2013,
    initialFare: 2013,
    commissionRate: 0.17,
    platformFee: 650,
    distanceBands: [
      { upToKm: 3, ratePerKm: 413 },
      { upToKm: 5, ratePerKm: 672 },
      { upToKm: 7, ratePerKm: 388 },
      { upToKm: 10, ratePerKm: 310 },
      { upToKm: 15, ratePerKm: 211 },
      { upToKm: Infinity, ratePerKm: 165 },
    ],
  },

  WAGON: {
    minFare: 2074,
    initialFare: 2074,
    commissionRate: 0.17,
    platformFee: 700,
    distanceBands: [
      { upToKm: 3, ratePerKm: 426 },
      { upToKm: 5, ratePerKm: 692 },
      { upToKm: 7, ratePerKm: 400 },
      { upToKm: 10, ratePerKm: 319 },
      { upToKm: 15, ratePerKm: 218 },
      { upToKm: Infinity, ratePerKm: 170 },
    ],
  },

  MINIBUS: {
    minFare: 12305,
    initialFare: 12305,
    commissionRate: 0.18,
    platformFee: 950,
    distanceBands: [
      { upToKm: 3, ratePerKm: 428 },
      { upToKm: 5, ratePerKm: 482 },
      { upToKm: 7, ratePerKm: 455 },
      { upToKm: 10, ratePerKm: 428 },
      { upToKm: 15, ratePerKm: 407 },
      { upToKm: Infinity, ratePerKm: 321 },
    ],
  },

  PICKUP: {
    minFare: 14124,
    initialFare: 14124,
    commissionRate: 0.19,
    platformFee: 1000,
    distanceBands: [
      { upToKm: 3, ratePerKm: 974 },
      { upToKm: 5, ratePerKm: 1102 },
      { upToKm: 7, ratePerKm: 990 },
      { upToKm: 10, ratePerKm: 947 },
      { upToKm: 15, ratePerKm: 931 },
      { upToKm: Infinity, ratePerKm: 588 },
    ],
  },

  SMALL_VAN: {
    minFare: 19260,
    initialFare: 19260,
    commissionRate: 0.2,
    platformFee: 1200,
    distanceBands: [
      { upToKm: 3, ratePerKm: 487 },
      { upToKm: 5, ratePerKm: 551 },
      { upToKm: 7, ratePerKm: 535 },
      { upToKm: 10, ratePerKm: 760 },
      { upToKm: 15, ratePerKm: 877 },
      { upToKm: Infinity, ratePerKm: 353 },
    ],
  },

  MEDIUM_VAN: {
    minFare: 23540,
    initialFare: 23540,
    commissionRate: 0.2,
    platformFee: 1300,
    distanceBands: [
      { upToKm: 3, ratePerKm: 535 },
      { upToKm: 5, ratePerKm: 599 },
      { upToKm: 7, ratePerKm: 578 },
      { upToKm: 10, ratePerKm: 813 },
      { upToKm: 15, ratePerKm: 942 },
      { upToKm: Infinity, ratePerKm: 374 },
    ],
  },

  LARGE_VAN: {
    minFare: 28890,
    initialFare: 28890,
    commissionRate: 0.21,
    platformFee: 1500,
    distanceBands: [
      { upToKm: 3, ratePerKm: 599 },
      { upToKm: 5, ratePerKm: 663 },
      { upToKm: 7, ratePerKm: 642 },
      { upToKm: 10, ratePerKm: 877 },
      { upToKm: 15, ratePerKm: 1017 },
      { upToKm: Infinity, ratePerKm: 407 },
    ],
  },

  TRUCK_5T: {
    minFare: 37450,
    initialFare: 37450,
    commissionRate: 0.22,
    platformFee: 2000,
    distanceBands: [
      { upToKm: 3, ratePerKm: 749 },
      { upToKm: 5, ratePerKm: 835 },
      { upToKm: 7, ratePerKm: 802 },
      { upToKm: 10, ratePerKm: 1070 },
      { upToKm: 15, ratePerKm: 1230 },
      { upToKm: Infinity, ratePerKm: 482 },
    ],
  },

  FLATBED_5T: {
    minFare: 40660,
    initialFare: 40660,
    commissionRate: 0.22,
    platformFee: 2150,
    distanceBands: [
      { upToKm: 3, ratePerKm: 781 },
      { upToKm: 5, ratePerKm: 877 },
      { upToKm: 7, ratePerKm: 845 },
      { upToKm: 10, ratePerKm: 1124 },
      { upToKm: 15, ratePerKm: 1284 },
      { upToKm: Infinity, ratePerKm: 503 },
    ],
  },

  TIPPER_5T: {
    minFare: 42800,
    initialFare: 42800,
    commissionRate: 0.22,
    platformFee: 2200,
    distanceBands: [
      { upToKm: 3, ratePerKm: 802 },
      { upToKm: 5, ratePerKm: 910 },
      { upToKm: 7, ratePerKm: 877 },
      { upToKm: 10, ratePerKm: 1156 },
      { upToKm: 15, ratePerKm: 1338 },
      { upToKm: Infinity, ratePerKm: 514 },
    ],
  },

  TRUCK_10T: {
    minFare: 51360,
    initialFare: 51360,
    commissionRate: 0.23,
    platformFee: 2300,
    distanceBands: [
      { upToKm: 3, ratePerKm: 910 },
      { upToKm: 5, ratePerKm: 1017 },
      { upToKm: 7, ratePerKm: 984 },
      { upToKm: 10, ratePerKm: 1284 },
      { upToKm: 15, ratePerKm: 1498 },
      { upToKm: Infinity, ratePerKm: 588 },
    ],
  },

  FLATBED_10T: {
    minFare: 55640,
    initialFare: 55640,
    commissionRate: 0.23,
    platformFee: 2500,
    distanceBands: [
      { upToKm: 3, ratePerKm: 942 },
      { upToKm: 5, ratePerKm: 1059 },
      { upToKm: 7, ratePerKm: 1027 },
      { upToKm: 10, ratePerKm: 1338 },
      { upToKm: 15, ratePerKm: 1552 },
      { upToKm: Infinity, ratePerKm: 610 },
    ],
  },

  TIPPER_10T: {
    minFare: 58850,
    initialFare: 58850,
    commissionRate: 0.23,
    platformFee: 2500,
    distanceBands: [
      { upToKm: 3, ratePerKm: 963 },
      { upToKm: 5, ratePerKm: 1091 },
      { upToKm: 7, ratePerKm: 1059 },
      { upToKm: 10, ratePerKm: 1391 },
      { upToKm: 15, ratePerKm: 1605 },
      { upToKm: Infinity, ratePerKm: 631 },
    ],
  },

  REFRIGERATED_5T: {
    minFare: 48150,
    initialFare: 48150,
    commissionRate: 0.23,
    platformFee: 2400,
    distanceBands: [
      { upToKm: 3, ratePerKm: 856 },
      { upToKm: 5, ratePerKm: 963 },
      { upToKm: 7, ratePerKm: 931 },
      { upToKm: 10, ratePerKm: 1230 },
      { upToKm: 15, ratePerKm: 1444 },
      { upToKm: Infinity, ratePerKm: 556 },
    ],
  },

  REFRIGERATED_10T: {
    minFare: 64200,
    initialFare: 64200,
    commissionRate: 0.24,
    platformFee: 2500,
    distanceBands: [
      { upToKm: 3, ratePerKm: 1017 },
      { upToKm: 5, ratePerKm: 1156 },
      { upToKm: 7, ratePerKm: 1124 },
      { upToKm: 10, ratePerKm: 1498 },
      { upToKm: 15, ratePerKm: 1766 },
      { upToKm: Infinity, ratePerKm: 696 },
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
