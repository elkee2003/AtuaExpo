// import { DataStore } from "aws-amplify/datastore";
import { generateClient } from "aws-amplify/api";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";

// import { Order } from "../../../src/models";

import styles from "./styles";

const client = generateClient();

const OrderHistoryList = ({ order, refreshOrders }) => {
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // ==========================================================
  // TRANSPORTATION TYPE
  // ==========================================================

  /*
   * Atua currently uses these transportation types:
   *
   * MICRO_EXPRESS
   * MICRO_BATCH
   * MOTO_EXPRESS
   * MOTO_BATCH
   *
   * Maxi remains:
   *
   * MAXI
   */

  const transportationType = String(
    order?.transportationType || "",
  ).toUpperCase();

  const isMaxi = transportationType === "MAXI";

  const isMicroOrMoto = [
    "MOTO_EXPRESS",
    "MOTO_BATCH",
    "MICRO_EXPRESS",
    "MICRO_BATCH",
  ].includes(transportationType);

  // ==========================================================
  // MAXI LIVE BIDDING
  // ==========================================================

  const showLiveBadge =
    isMaxi &&
    order?.status === "BIDDING" &&
    order?.hasNewOffer &&
    order?.lastOfferSenderType !== "USER";

  // ==========================================================
  // ACTIVE ORDER
  // ==========================================================

  const isLive = order?.status === "ACCEPTED";

  // ==========================================================
  // MICRO / MOTO AWAITING PAYMENT
  // ==========================================================

  /*
   * Micro/Moto orders can now exist in:
   *
   * AWAITING_PAYMENT
   *
   * This means:
   *
   * Order created
   *       ↓
   * AWAITING_PAYMENT
   *       ↓
   * User can close the app
   *       ↓
   * User comes back later
   *       ↓
   * User pays
   *       ↓
   * READY_FOR_PICKUP
   *
   * We intentionally check the Order status only.
   *
   * We do NOT require paymentStatus === "PENDING"
   * here because AWAITING_PAYMENT itself is the
   * persisted state that tells us payment is still
   * required.
   */

  const isAwaitingPayment =
    isMicroOrMoto && order?.status === "AWAITING_PAYMENT";

  // ==========================================================
  // DELETE ELIGIBILITY
  // ==========================================================

  /*
   * MAXI:
   *
   * BIDDING -> can delete
   *
   * MICRO / MOTO:
   *
   * AWAITING_PAYMENT -> can delete
   *
   * Once the order reaches READY_FOR_PICKUP or
   * another active delivery state, it cannot be deleted
   * from this screen.
   */

  const isMaxiUnpaid =
    isMaxi &&
    (order?.status === "BIDDING" ||
      (order?.status === "ACCEPTED" && order?.paymentStatus !== "PAID"));

  const canDelete =
    isMaxiUnpaid || (isMicroOrMoto && order?.status === "AWAITING_PAYMENT");

  // ==========================================================
  // TOGGLE EXPAND
  // ==========================================================

  const toggleExpand = () => {
    setExpanded((prev) => !prev);
  };

  // ==========================================================
  // NAVIGATION - ORDER DETAILS
  // ==========================================================

  const goToOrderDetails = () => {
    if (!order?.id) {
      return;
    }

    router.push(`/screens/orderdetails/${order.id}`);
  };

  // ==========================================================
  // NAVIGATION - TRACKING
  // ==========================================================

  const goToTracking = () => {
    if (!order?.id) {
      return;
    }

    router.push(`/screens/orderTrackingScreen/${order.id}`);
  };

  // ==========================================================
  // NAVIGATION - PAYMENT
  // ==========================================================

  /*
   * We pass the existing Order ID to the payment screen.
   *
   * IMPORTANT:
   *
   * We DO NOT create another order.
   */

  const goToPayment = () => {
    if (!isAwaitingPayment || !order?.id) {
      return;
    }

    router.push({
      pathname: "/screens/payment",
      params: {
        orderId: order.id,
      },
    });
  };

  // ==========================================================
  // DELETE ORDER
  // ==========================================================
  //
  // IMPORTANT:
  //
  // OrderHistoryList does NOT directly delete the Order anymore.
  //
  // Instead:
  //
  // OrderHistoryList
  //      ↓
  // permanentlyDeleteOrder(orderID)
  //      ↓
  // deleteOrder Lambda
  //      ↓
  // backend validates ownership + status
  //      ↓
  // MAXI offers are invalidated
  //      ↓
  // Order is deleted using AppSync versioning
  //
  // This keeps the backend as the final authority.
  // ==========================================================

  const deleteOrder = async () => {
    if (!canDelete || actionLoading || !order?.id) {
      return;
    }

    try {
      setActionLoading(true);

      /**
       * ------------------------------------------------------
       * Call the backend deletion mutation.
       * ------------------------------------------------------
       *
       * The Lambda will:
       *
       * 1. Authenticate the user.
       * 2. Resolve the Atua User.
       * 3. Verify Order ownership.
       * 4. Re-read the latest Order.
       * 5. Verify that the Order is still deletable.
       * 6. Invalidate MAXI offers when applicable.
       * 7. Re-read the Order again.
       * 8. Verify the Order version did not change.
       * 9. Permanently delete the Order.
       *
       * We therefore do NOT use DataStore.delete() here.
       */

      const mutation = /* GraphQL */ `
        mutation PermanentlyDeleteOrder($orderID: ID!) {
          permanentlyDeleteOrder(orderID: $orderID)
        }
      `;

      const result = await client.graphql({
        query: mutation,

        /**
         * This mutation is protected by:
         *
         * @auth(
         *   rules: [
         *     {
         *       allow: private,
         *       provider: userPools
         *     }
         *   ]
         * )
         */
        authMode: "userPool",

        variables: {
          orderID: order.id,
        },
      });

      const deleted = result?.data?.permanentlyDeleteOrder;

      /**
       * The Lambda returns Boolean.
       *
       * We require true before telling the user that the
       * deletion succeeded.
       */
      if (deleted !== true) {
        throw new Error("The order could not be deleted.");
      }

      /**
       * ------------------------------------------------------
       * Refresh the Order History.
       * ------------------------------------------------------
       *
       * observeQuery should normally update automatically,
       * but refreshOrders is kept as an additional UI refresh.
       */
      refreshOrders?.();
    } catch (error) {
      console.log("Delete order error:", error);

      /**
       * Amplify GraphQL errors can appear in different shapes.
       *
       * Try to extract the most useful message for the user.
       */
      const errorMessage =
        error?.errors?.[0]?.message ||
        error?.graphQLErrors?.[0]?.message ||
        error?.message ||
        "We could not delete this order. Please try again.";

      Alert.alert("Unable to Delete Order", errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================================
  // STATUS STYLE
  // ==========================================================

  const getStatusStyle = () => {
    switch (order?.status) {
      case "DELIVERED":
        return styles.statusDelivered;

      case "ACCEPTED":
      case "PICKED_UP":
        return styles.statusActive;

      case "CANCELLED":
        return styles.statusCancelled;

      default:
        return styles.statusPending;
    }
  };

  // ==========================================================
  // STATUS LABEL
  // ==========================================================

  const getStatusLabel = () => {
    if (isAwaitingPayment) {
      return "AWAITING PAYMENT";
    }

    return order?.status || "UNKNOWN";
  };

  // ==========================================================
  // ORDER PRICE
  // ==========================================================

  const getOrderPrice = () => {
    if (order?.totalPrice != null) {
      return Number(order.totalPrice).toLocaleString();
    }

    if (order?.initialOfferPrice != null) {
      return Number(order.initialOfferPrice).toLocaleString();
    }

    return "0";
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <View style={[styles.card, isLive && styles.cardActive]}>
      {/* =====================================================
          HEADER
      ===================================================== */}

      <TouchableOpacity activeOpacity={0.95} onPress={toggleExpand}>
        <View style={styles.topRow}>
          <Text style={styles.date}>
            {order?.createdAt ? order.createdAt.substring(0, 10) : ""}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            {/* LIVE OFFER BADGE */}

            {showLiveBadge && (
              <View style={styles.liveBadge}>
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}

            {/* STATUS */}

            <View style={[styles.statusBadge, getStatusStyle()]}>
              <Text style={styles.statusText}>{getStatusLabel()}</Text>
            </View>
          </View>
        </View>

        {/* ===================================================
            RECIPIENT
        =================================================== */}

        <Text style={styles.recipient}>
          {order?.recipientName || "Recipient"}
        </Text>

        {/* ===================================================
            PRICE + TRANSPORTATION
        =================================================== */}

        <View style={styles.bottomRow}>
          <Text style={styles.price}>₦{getOrderPrice()}</Text>

          <Text style={styles.transport}>
            {order?.transportationType || ""}
          </Text>
        </View>

        {/* ===================================================
            EXPAND / COLLAPSE INDICATOR
        =================================================== */}

        <Text style={styles.expandHint}>
          {expanded ? "Tap to collapse ▲" : "Tap to expand ▼"}
        </Text>
      </TouchableOpacity>

      {/* =====================================================
          EXPANDED CONTENT

          We intentionally use expanded && instead of
          react-native-collapsible.

          This makes the Pay and Delete buttons render
          directly when the card is expanded.
      ===================================================== */}

      {expanded && (
        <View style={styles.expandedContent}>
          {/* =================================================
              ORDER DETAILS
          ================================================= */}

          <Text style={styles.details}>
            {order?.orderDetails || "No order details available."}
          </Text>

          <View style={styles.divider} />

          {/* =================================================
              PAYMENT NOTICE
          ================================================= */}

          {isAwaitingPayment && (
            <View style={styles.paymentNotice}>
              <Text style={styles.paymentNoticeTitle}>Payment Required</Text>

              <Text style={styles.paymentNoticeText}>
                This order has not been paid for yet. Complete payment to
                continue with your delivery.
              </Text>
            </View>
          )}

          {/* =================================================
              TRACK / DETAILS BUTTONS
          ================================================= */}

          <View style={styles.buttonRow}>
            {/* TRACK */}

            <TouchableOpacity
              style={styles.primaryButton}
              disabled={actionLoading}
              onPress={goToTracking}
            >
              <Text style={styles.primaryText}>Track</Text>
            </TouchableOpacity>

            {/* DETAILS */}

            <TouchableOpacity
              style={styles.secondaryButton}
              disabled={actionLoading}
              onPress={goToOrderDetails}
            >
              <Text style={styles.secondaryText}>Details</Text>
            </TouchableOpacity>
          </View>

          {/* =================================================
              PAY NOW

              This will now show for:

              MOTO_EXPRESS
              MOTO_BATCH
              MICRO_EXPRESS
              MICRO_BATCH

              when status is AWAITING_PAYMENT.
          ================================================= */}

          {isAwaitingPayment && (
            <TouchableOpacity
              style={styles.payButton}
              disabled={actionLoading}
              onPress={goToPayment}
            >
              <Text style={styles.payButtonText}>
                {actionLoading ? "Please wait..." : `Pay ₦${getOrderPrice()}`}
              </Text>
            </TouchableOpacity>
          )}

          {/*
            =================================================
                DELETE ORDER

                This will now show for:

                MOTO_EXPRESS
                MOTO_BATCH
                MICRO_EXPRESS
                MICRO_BATCH

                when status is AWAITING_PAYMENT.

                It also remains available for:

                MAXI + BIDDING
                MAXI + ACCEPTED + UNPAID

                It is NOT available for:

                MAXI + ACCEPTED + PAID
            =================================================
          */}

          {canDelete && (
            <TouchableOpacity
              style={styles.dangerButton}
              disabled={actionLoading}
              onPress={() => {
                const isUnpaidMaxi =
                  isMaxi &&
                  (order?.status === "BIDDING" ||
                    (order?.status === "ACCEPTED" &&
                      order?.paymentStatus !== "PAID"));

                Alert.alert(
                  "Delete Order",
                  isAwaitingPayment
                    ? "This order has not been paid for yet. Are you sure you want to permanently delete it?"
                    : isUnpaidMaxi
                      ? order?.status === "BIDDING"
                        ? "This Maxi order is still bidding. Are you sure you want to permanently delete it?"
                        : "This Maxi order has been accepted but has not been paid for. Are you sure you want to permanently delete it?"
                      : "Are you sure you want to permanently delete this order?",
                  [
                    {
                      text: "Cancel",
                      style: "cancel",
                    },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: deleteOrder,
                    },
                  ],
                );
              }}
            >
              <Text style={styles.dangerText}>
                {actionLoading ? "Deleting..." : "Delete Order"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

export default OrderHistoryList;
