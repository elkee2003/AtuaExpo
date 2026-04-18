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

  /* ================= STATUS ================= */

  const renderStatusTitle = () => {
    switch (order.status) {
      case "READY_FOR_PICKUP":
        return "Searching for a courier...";
      case "ACCEPTED":
        return "Courier is on the way";
      case "IN_TRANSIT":
        return "Package in transit";
      case "DELIVERED":
        return "Delivered successfully";
      default:
        return "Processing...";
    }
  };

  const renderSubtitle = () => {
    if (order.status === "READY_FOR_PICKUP") {
      return "Notifying nearby couriers.";
    }

    if (order.status === "ACCEPTED") {
      return `${courier?.firstName || "Courier"} is heading to pickup`;
    }

    if (order.status === "IN_TRANSIT") {
      return "Your package is on the way to its destination";
    }

    if (order.status === "DELIVERED") {
      return "Delivery completed successfully";
    }

    return null;
  };

  /* ================= COPY PHONE ================= */

  const copyPhone = async () => {
    if (!courier?.phoneNumber) return;

    await Clipboard.setStringAsync(courier.phoneNumber);
    setCopied(true);

    setTimeout(() => setCopied(false), 2000);
  };

  /* ================= CONDITIONS ================= */

  const showDriverCard =
    ["ACCEPTED", "IN_TRANSIT"].includes(order.status) && courier;

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

      {/* CANCEL */}
      {order.status === "READY_FOR_PICKUP" && (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel Order</Text>
        </TouchableOpacity>
      )}

      {/* DRIVER CARD */}
      {showDriverCard && (
        <Animated.View
          style={[
            styles.driverCard,
            {
              opacity: driverCardAnim,
              transform: [
                {
                  translateY: driverCardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* IMAGE */}
          <Image
            source={
              courierImageUrl
                ? { uri: courierImageUrl }
                : require("../../../assets/images/placeholder.png")
            }
            style={styles.driverImage}
          />

          {/* INFO */}
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

            {/* PHONE */}
            {courier?.phoneNumber && (
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
