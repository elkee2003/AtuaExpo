export const biddingEngine = ({
  order,
  latestOffer, // 👈 THIS IS KEY
  newOffer,
  offeredBy, // "USER" | "COURIER"
  minIncrement = 500,
}) => {
  if (!order) {
    return { success: false, message: "Order not found." };
  }

  if (order.status !== "BIDDING") {
    return { success: false, message: "Bidding is closed." };
  }

  if (!newOffer || isNaN(newOffer)) {
    return { success: false, message: "Invalid offer amount." };
  }

  // 🔥 TURN LOGIC (based on latest offer, NOT order)
  if (latestOffer && latestOffer.senderType === offeredBy) {
    return {
      success: false,
      message: "Wait for the other party to respond.",
    };
  }

  const baseAmount = latestOffer?.amount ?? order.initialOfferPrice;

  // 🔥 increment or decrement check
  if (latestOffer) {
    const difference = newOffer - baseAmount;

    if (Math.abs(difference) < minIncrement) {
      return {
        success: false,
        message:
          difference > 0
            ? `Increase by at least ₦${minIncrement}`
            : difference < 0
              ? `Reduce by at least ₦${minIncrement}`
              : `Change amount by at least ₦${minIncrement}`,
      };
    }
  }

  // 🔥 range checks
  if (newOffer < order.estimatedMinPrice * 0.7) {
    return {
      success: false,
      message: "Offer too low",
    };
  }

  if (newOffer > order.estimatedMaxPrice * 1.5) {
    return {
      success: false,
      message: "Offer too high",
    };
  }

  // ✅ ACCEPT
  if (latestOffer && newOffer === latestOffer.amount) {
    return {
      success: true,
      action: "ACCEPT",
      finalPrice: newOffer,
    };
  }

  // ✅ COUNTER
  return {
    success: true,
    action: "COUNTER",
    amount: newOffer,
  };
};
