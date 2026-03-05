export const TRANSPORT_LABELS = {
  MOTO_EXPRESS: "Moto X",
  MICRO_EXPRESS: "Micro X",
  MOTO_BATCH: "Moto Batch",
  MICRO_BATCH: "Micro Batch",
  SMALL_VAN: "Small Van (1-1.5 Tons)",
  MEDIUM_VAN: "Medium Van (2-3 Tons)",
  LARGE_VAN: "Large Van (3-5 Tons)",
  TRUCK_5T: "5 Ton Truck",
  TRUCK_10T: "10 Ton Truck",
  TRUCK_20T: "20 Ton Truck",
  FLATBED_5T: "Flatbed 5 Ton",
  FLATBED_10T: "Flatbed 10 Ton",
  FLATBED_20T: "Flatbed 20 Ton",
  TIPPER_5T: "Tipper 5 Ton",
  TIPPER_10T: "Tipper 10 Ton",
  TIPPER_20T: "Tipper 20 Ton",
  REFRIGERATED_5T: "Refrigerated 5 Ton",
  REFRIGERATED_10T: "Refrigerated 10 Ton",
};

export const getTransportLabel = (type) => {
  return TRANSPORT_LABELS[type] || type;
};
