import { Animated, Image, Text, TouchableOpacity, View } from "react-native";
import styles from "./styles";

const DefaultTrackingSheet = ({ order, courier, driverCardAnim, onCancel }) => {
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
      return "Notifying nearby drivers.";
    }
    if (order.status === "ACCEPTED") {
      return `${courier?.firstName || "Driver"} is heading to pickup`;
    }
    return null;
  };

  return (
    <View style={styles.sheetContent}>
      <Text style={styles.statusTitle}>{renderStatusTitle()}</Text>
      <Text style={styles.statusSubtitle}>{renderSubtitle()}</Text>

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
            source={{ uri: courier.profilePic }}
            style={styles.driverImage}
          />
          <View>
            <Text style={styles.driverName}>
              {courier.firstName} {courier.lastName}
            </Text>
            <Text style={styles.driverSub}>{courier.transportationType}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

export default DefaultTrackingSheet;
