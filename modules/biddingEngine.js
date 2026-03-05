export const biddingEngine = ({
  order,
  newOffer,
  offeredBy, // "SENDER" or "DRIVER"
  minIncrement = 500,
}) => {
  if (!order) {
    return { success: false, message: "Order not found." };
  }

  if (order.status !== "BIDDING") {
    return { success: false, message: "Bidding is closed." };
  }

  // Prevent same side offering twice
  if (order.lastOfferBy === offeredBy) {
    return {
      success: false,
      message: "Wait for the other party to respond.",
    };
  }

  // Validate number
  if (!newOffer || isNaN(newOffer)) {
    return { success: false, message: "Invalid offer amount." };
  }

  // Prevent ridiculous lowball
  if (newOffer < order.estimatedMinPrice * 0.7) {
    return {
      success: false,
      message: "Offer too low compared to market estimate.",
    };
  }

  // Enforce minimum increment
  const difference = Math.abs(newOffer - order.currentOfferPrice);
  if (difference < minIncrement) {
    return {
      success: false,
      message: `Minimum increment is ₦${minIncrement}.`,
    };
  }

  // Prevent insane jump (optional protection)
  if (newOffer > order.estimatedMaxPrice * 1.5) {
    return {
      success: false,
      message: "Offer exceeds reasonable range.",
    };
  }

  // ACCEPTANCE CONDITION
  // If new offer equals current offer → agreement
  if (newOffer === order.currentOfferPrice) {
    return {
      success: true,
      action: "ACCEPTED",
      finalPrice: newOffer,
    };
  }

  // Valid counter offer
  return {
    success: true,
    action: "COUNTERED",
    updatedOrder: {
      ...order,
      currentOfferPrice: newOffer,
      lastOfferBy: offeredBy,
    },
  };
};
