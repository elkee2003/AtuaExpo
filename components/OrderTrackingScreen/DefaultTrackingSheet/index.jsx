import { getUrl } from "aws-amplify/storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, Image, Text, TouchableOpacity, View } from "react-native";
import styles from "./styles";

// note I have to show bidding and the current offer when user navigates to the tracking page or when waiting for courier to accept order

const DefaultTrackingSheet = ({ order, courier, driverCardAnim, onCancel }) => {
  const [courierImage, setCourierImage] = useState(null);
  const [loadingImage, setLoadingImage] = useState(true);

  const renderStatusTitle = () => {
    switch (order.status) {
      case "READY_FOR_PICKUP":
        return "Searching for a courier...";
      case "ACCEPTED":
        return "Driver is on the way";
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
    return null;
  };

  // useEffect to fetch Courier Profile Image
  useEffect(() => {
    const fetchCourierImage = async () => {
      if (!courier?.profilePic) {
        setCourierImage(null);
        setLoadingImage(false);
        return;
      }

      try {
        const result = await getUrl({
          path: courier.profilePic,
          options: {
            validateObjectExistence: true,
          },
        });

        setCourierImage(result.url.toString());
      } catch (e) {
        console.log("Error fetching courier image:", e);
        setCourierImage(null);
      } finally {
        setLoadingImage(false);
      }
    };

    fetchCourierImage();
  }, [courier?.profilePic]);

  return (
    <View style={styles.sheetContent}>
      <Text style={styles.statusTitle}>{renderStatusTitle()}</Text>
      <Text style={styles.statusSubtitle}>{renderSubtitle()}</Text>

      <Text
        style={styles.orderText}
        onPress={() => {
          router.push("/orderhistory");
        }}
      >
        Order History
      </Text>

      {order.status === "READY_FOR_PICKUP" && (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel Order</Text>
        </TouchableOpacity>
      )}

      {order.status === "ACCEPTED" && courier && (
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
          <Image
            source={
              loadingImage || !courierImage
                ? require("../../../assets/images/placeholder.png")
                : { uri: courierImage }
            }
            style={styles.driverImage}
          />

          <View style={styles.driverInfo}>
            {/* Name */}
            <Text style={styles.driverName}>
              {courier.firstName}
              {/* {courier.lastName} */}
            </Text>

            {/* Vehicle */}
            <Text style={styles.driverSub}>
              {courier.transportationType} • {courier.vehicleClass}
            </Text>

            {courier?.vehicleColour && (
              <Text style={styles.driverMeta}>
                {courier.vehicleColour} • {courier.plateNumber}
              </Text>
            )}

            {/* Price badge */}
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
