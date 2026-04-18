import { DataStore } from "aws-amplify/datastore";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import Collapsible from "react-native-collapsible";
import { Order } from "../../../src/models";
import styles from "./styles";

const OrderHistoryList = ({ order, refreshOrders }) => {
  const [expanded, setExpanded] = useState(false);

  const showLiveBadge =
    order.transportationType === "MAXI" &&
    order.status === "BIDDING" &&
    order.hasNewOffer &&
    order.lastOfferSenderType !== "USER";

  const isLive = order.status === "ACCEPTED";

  const toggleExpand = () => {
    setExpanded((prev) => !prev); // ✅ now toggles properly
  };

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
        refreshOrders?.();
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
            updated.assignedCourierId = null;
          }),
        );
        refreshOrders?.();
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
      onPress={toggleExpand}
    >
      {/* Header */}
      <View style={styles.topRow}>
        <Text style={styles.date}>{order?.createdAt?.substring(0, 10)}</Text>

        {/* LIVE OFFER BADGE AND STATUS */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Live Order display */}
          {showLiveBadge && (
            <View style={styles.liveBadge}>
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}

          {/* Status display */}
          <View style={[styles.statusBadge, getStatusStyle()]}>
            <Text style={styles.statusText}>{order.status}</Text>
          </View>
        </View>
      </View>

      {/* Summary */}
      <Text style={styles.recipient}>{order.recipientName}</Text>

      <View style={styles.bottomRow}>
        <Text style={styles.price}>
          ₦
          {order?.totalPrice?.toLocaleString() ||
            order?.initialOfferPrice?.toLocaleString()}
        </Text>
        <Text style={styles.transport}>{order.transportationType}</Text>
      </View>

      <Text style={styles.expandHint}>
        {expanded ? "Tap to collapse ▲" : "Tap to expand ▼"}
      </Text>

      {/* Expanded */}
      <Collapsible collapsed={!expanded}>
        <View style={styles.expandedContent}>
          <Text style={styles.details}>{order.orderDetails}</Text>

          <View style={styles.divider} />

          {/* Buttons Row */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={(e) => {
                e.stopPropagation();
                goToTracking();
              }}
            >
              <Text style={styles.primaryText}>Track</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={(e) => {
                e.stopPropagation();
                goToOrderDetails();
              }}
            >
              <Text style={styles.secondaryText}>Details</Text>
            </TouchableOpacity>
          </View>

          {/* Conditional Actions */}
          {order.status === "READY_FOR_PICKUP" && (
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={(e) => {
                e.stopPropagation();
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
                );
              }}
            >
              <Text style={styles.dangerText}>Delete Order</Text>
            </TouchableOpacity>
          )}

          {order.status === "ACCEPTED" && (
            <TouchableOpacity
              style={styles.warningButton}
              onPress={(e) => {
                e.stopPropagation();
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
                );
              }}
            >
              <Text style={styles.warningText}>Cancel Delivery</Text>
            </TouchableOpacity>
          )}
        </View>
      </Collapsible>
    </TouchableOpacity>
  );
};

export default OrderHistoryList;
