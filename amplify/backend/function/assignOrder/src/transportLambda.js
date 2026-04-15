// This is a helper function for my lambda to connect MOTO_BATCH, MOTO_EXPRESS to Courier of transportationType MOTO and MICRO_BATCH or MICRO_EXPRESS to transportationType MICRO

function getBaseType(type) {
  if (!type) return null;
  return type.split("_")[0];
}

function isTransportCompatible(order, courier) {
  return getBaseType(order.transportationType) === courier.transportationType;
}

module.exports = { isTransportCompatible };
