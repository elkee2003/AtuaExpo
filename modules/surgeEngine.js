// Note I'm not using it yet- it is for future
export const surgeEngine = ({
  baseFare,
  demandLevel, // LOW | NORMAL | HIGH
  driverSupply,
}) => {
  let multiplier = 1;

  if (demandLevel === "HIGH" && driverSupply < 5) {
    multiplier = 1.25;
  }

  if (demandLevel === "EXTREME") {
    multiplier = 1.5;
  }

  return {
    surgeMultiplier: multiplier,
    surgedFare: Math.round(baseFare * multiplier),
  };
};
