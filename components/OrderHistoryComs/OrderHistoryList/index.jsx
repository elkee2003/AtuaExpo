import { DataStore } from "aws-amplify/datastore";
import { router } from "expo-router";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { Order } from "../../../src/models";
import styles from "./styles";

const OrderHistoryList = ({ order, refreshOrders }) => {
  const isLive = order.status === "ACCEPTED";

  const goToOrderDetails = () => {
    router.push(`/screens/orderdetails/${order.id}`);
  };

  const goToTracking = () => {
    router.push(`/screens/orderTrackingScreen/${order.id}`);
  };

  const deleteOrder = async () => {
    try {
      const orderToDelete = await DataStore.query(Order, order.id);
      if (orderToDelete) {
        await DataStore.delete(orderToDelete);
        refreshOrders();
      }
    } catch (error) {
      console.log("Delete error:", error);
    }
  };

  const cancelOrder = async () => {
    try {
      const orderToCancel = await DataStore.query(Order, order.id);
      if (orderToCancel) {
        await DataStore.save(
          Order.copyOf(orderToCancel, (updated) => {
            updated.status = "READY_FOR_PICKUP";
            updated.orderCourierId = null;
          }),
        );
        refreshOrders();
      }
    } catch (error) {
      console.log("Cancel error:", error);
    }
  };

  const getStatusStyle = () => {
    switch (order.status) {
      case "DELIVERED":
        return styles.statusDelivered;
      case "ACCEPTED":
      case "PICKEDUP":
        return styles.statusActive;
      case "CANCELLED":
        return styles.statusCancelled;
      default:
        return styles.statusPending;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      style={[styles.card, isLive && styles.cardActive]}
      onPress={goToOrderDetails}
    >
      {/* Top Row */}
      <View style={styles.topRow}>
        <Text style={styles.date}>{order?.createdAt?.substring(0, 10)}</Text>

        <View style={[styles.statusBadge, getStatusStyle()]}>
          <Text style={styles.statusText}>{order.status}</Text>
        </View>
      </View>

      {/* Main Content */}
      <Text style={styles.recipient}>{order.recipientName}</Text>
      <Text style={styles.details} numberOfLines={2}>
        {order.orderDetails}
      </Text>

      <View style={styles.divider} />

      {/* Bottom Row */}
      <View style={styles.bottomRow}>
        <Text style={styles.price}>
          ₦
          {order?.totalPrice?.toLocaleString() ||
            order?.initialOfferPrice?.toLocaleString()}
        </Text>
        <Text style={styles.transport}>{order.transportationType}</Text>
      </View>

      <TouchableOpacity style={styles.trackButton} onPress={goToTracking}>
        <Text style={styles.trackText}>Order Tracking</Text>
      </TouchableOpacity>

      {/* READY_FOR_PICKUP → Delete */}
      {order.status === "READY_FOR_PICKUP" && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() =>
            Alert.alert(
              "Delete Order",
              "Are you sure you want to permanently delete this order?",
              [
                { text: "Cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: deleteOrder,
                },
              ],
            )
          }
        >
          <Text style={styles.deleteText}>Delete Order</Text>
        </TouchableOpacity>
      )}

      {/* ACCEPTED → Cancel */}
      {order.status === "ACCEPTED" && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() =>
            Alert.alert(
              "Cancel Delivery",
              "Do you want to cancel this delivery?",
              [
                { text: "No" },
                {
                  text: "Yes",
                  style: "destructive",
                  onPress: cancelOrder,
                },
              ],
            )
          }
        >
          <Text style={styles.cancelText}>Cancel Delivery</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

export default OrderHistoryList;
