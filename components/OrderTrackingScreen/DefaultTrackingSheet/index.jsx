import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { Animated, Image, Text, TouchableOpacity, View } from "react-native";
import styles from "./styles";

const DefaultTrackingSheet = ({
  order,
  courier,
  courierImageUrl,
  driverCardAnim,
  onCancel,
}) => {
  const [copied, setCopied] = useState(false);

  const renderStatusTitle = () => {
    switch (order.status) {
      case "READY_FOR_PICKUP":
        return "Searching for a courier...";

      case "BIDDING":
        return "Finding the best offer...";

      case "ACCEPTED":
        return "Courier is on the way";

      case "ARRIVED_PICKUP":
        return "Courier has arrived";

      case "LOADING":
        return "Your shipment is being loaded";

      case "PICKED_UP":
        return "Shipment picked up";

      case "IN_TRANSIT":
        return "Package in transit";

      case "ARRIVED_DROPOFF":
        return "Courier has arrived at destination";

      case "UNLOADING":
        return "Your shipment is being unloaded";

      case "DELIVERED":
        return "Delivered successfully";

      case "CANCELLED":
        return "Delivery cancelled";

      case "DISPUTED":
        return "Delivery under review";

      default:
        return "Processing...";
    }
  };

  const renderSubtitle = () => {
    switch (order.status) {
      case "READY_FOR_PICKUP":
        return "Notifying nearby couriers.";

      case "BIDDING":
        return "Couriers are reviewing your delivery.";

      case "ACCEPTED":
        return `${courier?.firstName || "Courier"} is heading to pickup`;

      case "ARRIVED_PICKUP":
        return `${
          courier?.firstName || "Your courier"
        } has arrived at the pickup location`;

      case "LOADING":
        return "Your shipment is being loaded onto the vehicle";

      case "PICKED_UP":
        return "Your shipment has been collected and is ready for delivery";

      case "IN_TRANSIT":
        return "Your package is on the way to its destination";

      case "ARRIVED_DROPOFF":
        return `${
          courier?.firstName || "Your courier"
        } has arrived at the delivery location`;

      case "UNLOADING":
        return "Your shipment is being unloaded";

      case "DELIVERED":
        return "Delivery completed successfully";

      case "CANCELLED":
        return "This delivery has been cancelled";

      case "DISPUTED":
        return "Your delivery is currently under review";

      default:
        return null;
    }
  };

  const copyPhone = async () => {
    if (!courier?.phoneNumber) return;

    await Clipboard.setStringAsync(courier.phoneNumber);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const activeCourierStatuses = [
    "ACCEPTED",
    "ARRIVED_PICKUP",
    "LOADING",
    "PICKED_UP",
    "IN_TRANSIT",
    "ARRIVED_DROPOFF",
    "UNLOADING",
  ];

  const showDriverCard =
    activeCourierStatuses.includes(order?.status) && !!courier;

  const canShowPhone =
    !!courier?.phoneNumber &&
    (order?.transportationType !== "MAXI" || order?.paymentStatus === "PAID");

  return (
    <View style={styles.sheetContent}>
      {/* STATUS */}
      <View style={styles.statusContainer}>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />

          <Text style={styles.statusTitle}>{renderStatusTitle()}</Text>
        </View>

        <Text style={styles.statusSubtitle}>{renderSubtitle()}</Text>
      </View>

      {/* ORDER HISTORY */}
      <Text
        style={styles.orderText}
        onPress={() => router.push("/orderhistory")}
      >
        Order History
      </Text>

      {/* CANCEL ORDER */}
      {((order.status === "READY_FOR_PICKUP" &&
        order.paymentStatus === "PAID") ||
        (order.transportationType === "MAXI" &&
          order.status === "ACCEPTED" &&
          order.paymentStatus === "PAID")) && (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel Order</Text>
        </TouchableOpacity>
      )}

      {/* COURIER CARD */}
      {showDriverCard && (
        <Animated.View
          style={[
            styles.driverCard,
            {
              transform: [
                {
                  translateY: driverCardAnim,
                },
              ],
            },
          ]}
        >
          <Image
            source={
              courierImageUrl
                ? { uri: courierImageUrl }
                : require("../../../assets/images/placeholder.png")
            }
            style={styles.driverImage}
          />

          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{courier.firstName}</Text>

            <Text style={styles.driverSub}>
              {courier.transportationType} • {courier.vehicleClass}
            </Text>

            {courier?.vehicleColour && (
              <Text style={styles.driverMeta}>
                {courier.vehicleColour} • {courier.plateNumber}
              </Text>
            )}

            {/* PHONE NUMBER */}
            {canShowPhone && (
              <TouchableOpacity onPress={copyPhone}>
                <Text style={styles.phoneText}>{courier.phoneNumber}</Text>

                <Text style={styles.copyHint}>
                  {copied ? "Copied!" : "Tap to copy"}
                </Text>
              </TouchableOpacity>
            )}

            {/* PRICE */}
            <View style={styles.priceBadge}>
              <Text style={styles.priceText}>
                ₦{order?.totalPrice?.toLocaleString()}
              </Text>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

export default DefaultTrackingSheet;
