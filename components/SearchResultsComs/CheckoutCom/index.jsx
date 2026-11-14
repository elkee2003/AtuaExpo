import { useAuthContext } from "@/providers/AuthProvider";
import { useLocationContext } from "@/providers/LocationProvider";
import { useOrderContext } from "@/providers/OrderProvider";
import { Order } from "@/src/models";
import { getTransportLabel } from "@/utils/transportFormatter";
import * as Crypto from "expo-crypto";

import Ionicons from "@expo/vector-icons/Ionicons";
import { DataStore } from "aws-amplify/datastore";
import { router } from "expo-router";

import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import styles from "./styles";

// FOR CASH ORDER GENERATION OF VERIFICATION CODE
const generateVerificationCode = async () => {
  const range = 900000;
  const maxValue = 4294967296; // 2^32

  // Reject values that would introduce modulo bias.
  const limit = Math.floor(maxValue / range) * range;

  while (true) {
    const randomBytes = await Crypto.getRandomBytesAsync(4);

    // Convert 4 cryptographically secure random bytes
    // into an unsigned 32-bit integer.
    const randomValue =
      randomBytes[0] * 0x1000000 +
      randomBytes[1] * 0x10000 +
      randomBytes[2] * 0x100 +
      randomBytes[3];

    if (randomValue < limit) {
      return String(100000 + (randomValue % range));
    }
  }
};

const Checkout = () => {
  //-----------------------------------------
  // Context
  //-----------------------------------------

  const { dbUser } = useAuthContext();

  const {
    originAddress,
    destinationAddress,
    originLat,
    originLng,
    destinationLat,
    destinationLng,
    originState,
    destinationState,
    isInterState,
    tripType,
    setTripType,
    totalKm,
  } = useLocationContext();

  const {
    paymentResponsibility,
    paymentTiming,
    paymentMethod,
    senderName,
    senderNumber,
    senderNumber2,
    recipientName,
    recipientNumber,
    recipientNumber2,
    orderDetails,
    transportationType,
    operationalFare,
    totalPrice,
    courierEarnings,
    commissionAmount,
    platformFee,
    platformServiceRevenue,
    vatAmount,
    platformNetRevenue,
  } = useOrderContext();

  //-----------------------------------------
  // State
  //-----------------------------------------

  const [loading, setLoading] = useState(false);

  //-----------------------------------------
  // Set Trip Type
  //-----------------------------------------

  useEffect(() => {
    setTripType(isInterState ? "INTERSTATE" : "INTRASTATE");
  }, [isInterState, setTripType]);

  //-----------------------------------------
  // Validate Order
  //-----------------------------------------

  const validateOrder = () => {
    //-------------------------------------
    // User
    //-------------------------------------

    if (!dbUser?.id) {
      Alert.alert(
        "Account Error",
        "We could not identify your account. Please try again.",
      );

      return false;
    }

    //-------------------------------------
    // Recipient
    //-------------------------------------

    if (!recipientName?.trim()) {
      Alert.alert("Recipient Required", "Please enter the recipient's name.");

      return false;
    }

    if (!recipientNumber?.trim()) {
      Alert.alert(
        "Phone Number Required",
        "Please enter the recipient's phone number.",
      );

      return false;
    }

    //-------------------------------------
    // Locations
    //-------------------------------------

    if (!originAddress?.data?.description) {
      Alert.alert("Pickup Required", "Please select a valid pickup location.");

      return false;
    }

    if (!destinationAddress?.data?.description) {
      Alert.alert(
        "Destination Required",
        "Please select a valid delivery destination.",
      );

      return false;
    }

    //-------------------------------------
    // Transportation
    //-------------------------------------

    if (!transportationType) {
      Alert.alert(
        "Transportation Required",
        "Please select a transportation type.",
      );

      return false;
    }

    // Payment arrangement validation

    const validPaymentArrangements = [
      {
        responsibility: "SENDER",
        timing: "BEFORE_PICKUP",
        method: "PAYSTACK",
      },
      {
        responsibility: "SENDER",
        timing: "AT_PICKUP",
        method: "CASH",
      },
      {
        responsibility: "RECEIVER",
        timing: "BEFORE_PICKUP",
        method: "PAYSTACK",
      },
      {
        responsibility: "RECEIVER",
        timing: "ON_DELIVERY",
        method: "PAYSTACK",
      },
      {
        responsibility: "RECEIVER",
        timing: "ON_DELIVERY",
        method: "CASH",
      },
      {
        responsibility: "RECEIVER",
        timing: "ON_DELIVERY",
        method: null,
      },
    ];

    const validPaymentArrangement = validPaymentArrangements.some(
      (option) =>
        option.responsibility === paymentResponsibility &&
        option.timing === paymentTiming &&
        option.method === paymentMethod,
    );

    if (!validPaymentArrangement) {
      Alert.alert(
        "Payment Arrangement Required",
        "Please return to the sender and recipient details screen and select a valid payment arrangement.",
      );

      return false;
    }

    //-------------------------------------
    // Price
    //-------------------------------------

    const amount = Number(totalPrice);

    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert(
        "Invalid Price",
        "We could not determine the price for this delivery.",
      );

      return false;
    }

    return true;
  };

  //-----------------------------------------
  // Create Pending Order
  //-----------------------------------------

  const handleOrder = async () => {
    //-------------------------------------
    // Prevent Duplicate Submission
    //-------------------------------------

    if (loading) {
      return;
    }

    //-------------------------------------
    // Validate
    //-------------------------------------

    if (!validateOrder()) {
      return;
    }

    try {
      setLoading(true);

      //-------------------------------------
      // Create Pending Order
      //-------------------------------------
      //
      // Cash payment arrangements receive a
      // delivery verification code at creation.
      //
      // Paystack payment arrangements receive
      // a code after successful payment.
      //
      // If the receiver chooses their payment method on delivery,
      // generate the verification code now so it is already available
      // whether they later choose cash or electronic payment.
      //
      // The order must not be assigned to a
      // courier until payment rules are met.
      //-------------------------------------

      // Generate a delivery verification code at order creation when:
      // 1. The sender is paying cash, OR
      // 2. The receiver is responsible for payment, regardless
      //    of whether they will eventually pay cash or electronically.
      const shouldGenerateVerificationCode =
        paymentMethod === "CASH" || paymentResponsibility === "RECEIVER";

      const deliveryVerificationCode = shouldGenerateVerificationCode
        ? await generateVerificationCode()
        : undefined;

      const order = await DataStore.save(
        new Order({
          //---------------------------------
          // Order Environment
          //---------------------------------

          // REAL customer orders must be PRODUCTION.
          // TEST orders should explicitly use TEST.
          orderEnvironment: "PRODUCTION",
          // orderEnvironment: "TEST",

          // Booking source
          bookingSource: "APP",

          // Payment arrangement
          paymentResponsibility,
          paymentTiming,
          paymentMethod,

          // Sender
          senderName: senderName?.trim() || null,
          senderNumber: senderNumber?.trim() || null,
          senderNumber2: senderNumber2?.trim() || null,

          // Recipient
          recipientName: recipientName.trim(),
          recipientNumber: recipientNumber.trim(),
          recipientNumber2: recipientNumber2?.trim() || null,

          orderDetails: orderDetails?.trim() || null,

          //---------------------------------
          // Transportation
          //---------------------------------

          transportationType,

          //---------------------------------
          // Pricing
          //---------------------------------

          operationalFare: Number(operationalFare),

          totalPrice: Number(totalPrice),

          courierEarnings: Number(courierEarnings),

          commissionAmount: Number(commissionAmount),

          platformFee: Number(platformFee),

          platformServiceRevenue: Number(platformServiceRevenue),

          vatAmount: Number(vatAmount),

          platformNetRevenue: Number(platformNetRevenue),

          deliveryVerificationCode,

          //---------------------------------
          // Pickup
          //---------------------------------

          originAddress: originAddress?.data?.description,

          originState,

          originLat: Number(originLat),

          originLng: Number(originLng),

          //---------------------------------
          // Destination
          //---------------------------------

          destinationAddress: destinationAddress?.data?.description,

          destinationState,

          destinationLat: Number(destinationLat),

          destinationLng: Number(destinationLng),

          //---------------------------------
          // Trip
          //---------------------------------

          tripType,

          isInterState,

          distance: `${totalKm} km`,

          //---------------------------------
          // User
          //---------------------------------

          userID: dbUser.id,

          //---------------------------------
          // Status
          //---------------------------------
          status: "AWAITING_PAYMENT",

          //---------------------------------
          // Payment
          //---------------------------------
          //
          // Payment has not happened yet.
          //
          //---------------------------------

          paymentStatus: "PENDING",

          payoutStatus: "NOT_PAID",

          fundsStatus: "HELD",

          //---------------------------------
          // ORDER STATUS NOTES
          //---------------------------------
          //
          // Cash orders may already have a
          // delivery verification code.
          //
          // Paystack orders receive their code
          // after successful payment.
          //
          // Do not mark an order READY_FOR_PICKUP
          // until the applicable payment rules
          // have been satisfied.
          //
          //---------------------------------
        }),
      );

      //-------------------------------------
      // Navigate After Order Creation
      //-------------------------------------

      if (paymentTiming === "BEFORE_PICKUP" && paymentMethod === "PAYSTACK") {
        // Payment is required before pickup.
        // Only the sender pays through this screen.
        router.push({
          pathname: "/screens/payment",
          params: {
            orderId: order.id,
          },
        });
      } else {
        // All Pay on Delivery and Cash at Pickup orders
        // go directly to Order History.
        router.replace("/orderhistory");
      }

      // if (
      //   paymentResponsibility === "RECEIVER" &&
      //   ((paymentTiming === "BEFORE_PICKUP" && paymentMethod === "PAYSTACK") ||
      //     (paymentTiming === "ON_DELIVERY" && paymentMethod == null))
      // ) {
      //   router.push({
      //     pathname: "/screens/payment/receiverpayment",
      //     params: {
      //       orderId: order.id,
      //     },
      //   });
      // } else if (
      //   paymentTiming === "BEFORE_PICKUP" &&
      //   paymentMethod === "PAYSTACK"
      // ) {
      //   router.push({
      //     pathname: "/screens/payment",
      //     params: {
      //       orderId: order.id,
      //     },
      //   });
      // } else {
      //   router.push("/orderhistory");
      // }
    } catch (error) {
      console.log("CREATE ORDER ERROR:", error);

      Alert.alert(
        "Unable to Continue",
        error?.message ||
          "We couldn't prepare your delivery. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  //-----------------------------------------
  // Render
  //-----------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} disabled={loading}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>

        <Text style={styles.title}>Review Order</Text>

        <View style={{ width: 22 }} />
      </View>

      {/* Content */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Sender */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Sender</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{senderName || "—"}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{senderNumber || "—"}</Text>
          </View>

          {senderNumber2 ? (
            <View style={styles.row}>
              <Text style={styles.label}>Backup</Text>
              <Text style={styles.value}>{senderNumber2}</Text>
            </View>
          ) : null}
        </View>

        {/* Recipient */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recipient</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>

            <Text style={styles.value}>{recipientName}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Phone</Text>

            <Text style={styles.value}>{recipientNumber}</Text>
          </View>

          {recipientNumber2 ? (
            <View style={styles.row}>
              <Text style={styles.label}>Backup</Text>

              <Text style={styles.value}>{recipientNumber2}</Text>
            </View>
          ) : null}
        </View>

        {/* Route */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery Route</Text>

          <View style={styles.locationRow}>
            <Ionicons name="ellipse" size={12} color="#10B981" />

            <Text style={styles.locationText}>
              {originAddress?.data?.description}
            </Text>
          </View>

          <View style={styles.verticalLine} />

          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color="#EF4444" />

            <Text style={styles.locationText}>
              {destinationAddress?.data?.description}
            </Text>
          </View>
        </View>

        {/* Package Details */}

        {orderDetails ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Package Details</Text>

            <Text style={styles.detailsText}>{orderDetails}</Text>
          </View>
        ) : null}

        {/* Payment Arrangement */}
        <View style={styles.paymentResponsibilityCard}>
          <Text style={styles.sectionTitle}>Payment Arrangement</Text>

          <View style={styles.paymentResponsibilityRow}>
            <View style={styles.paymentResponsibilityIcon}>
              <Ionicons
                name={
                  paymentResponsibility === "RECEIVER"
                    ? "person-add-outline"
                    : "person-outline"
                }
                size={21}
                color="#374151"
              />
            </View>

            <View style={styles.paymentResponsibilityContent}>
              <Text style={styles.paymentResponsibilityLabel}>
                Who will pay?
              </Text>

              <Text style={styles.paymentResponsibilityValue}>
                {paymentResponsibility === "RECEIVER"
                  ? "Receiver will pay"
                  : "Sender will pay"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.paymentResponsibilityRow}>
            <View style={styles.paymentResponsibilityIcon}>
              <Ionicons
                name={
                  paymentMethod === "CASH"
                    ? "cash-outline"
                    : paymentMethod === "PAYSTACK"
                      ? "card-outline"
                      : "help-circle-outline"
                }
                size={21}
                color="#374151"
              />
            </View>

            <View style={styles.paymentResponsibilityContent}>
              <Text style={styles.paymentResponsibilityLabel}>
                Payment method
              </Text>

              <Text style={styles.paymentResponsibilityValue}>
                {paymentMethod === "CASH"
                  ? "Cash"
                  : paymentMethod === "PAYSTACK"
                    ? "Paystack"
                    : "Receiver chooses on delivery"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.paymentResponsibilityRow}>
            <View style={styles.paymentResponsibilityIcon}>
              <Ionicons name="time-outline" size={21} color="#374151" />
            </View>

            <View style={styles.paymentResponsibilityContent}>
              <Text style={styles.paymentResponsibilityLabel}>
                When will payment be made?
              </Text>

              <Text style={styles.paymentResponsibilityValue}>
                {paymentTiming === "BEFORE_PICKUP"
                  ? "Before pickup"
                  : paymentTiming === "AT_PICKUP"
                    ? "At pickup"
                    : "On delivery"}
              </Text>
            </View>
          </View>

          <Text style={styles.paymentResponsibilityDescription}>
            {paymentResponsibility === "SENDER" &&
              paymentTiming === "BEFORE_PICKUP" &&
              paymentMethod === "PAYSTACK" &&
              "You will complete electronic payment before the courier picks up your item."}

            {paymentResponsibility === "SENDER" &&
              paymentTiming === "AT_PICKUP" &&
              paymentMethod === "CASH" &&
              "You will pay the courier in cash when your item is picked up."}

            {paymentResponsibility === "RECEIVER" &&
              paymentTiming === "BEFORE_PICKUP" &&
              paymentMethod === "PAYSTACK" &&
              "The receiver must complete electronic payment before pickup."}

            {paymentResponsibility === "RECEIVER" &&
              paymentTiming === "ON_DELIVERY" &&
              paymentMethod === "PAYSTACK" &&
              "The receiver will pay electronically when the item is delivered."}

            {paymentResponsibility === "RECEIVER" &&
              paymentTiming === "ON_DELIVERY" &&
              paymentMethod === "CASH" &&
              "The receiver will pay the courier in cash on delivery."}

            {paymentResponsibility === "RECEIVER" &&
              paymentTiming === "ON_DELIVERY" &&
              paymentMethod == null &&
              "The receiver can choose to pay in cash or electronically when the courier arrives. Electronic payments must be verified before the delivery is treated as paid. If the receiver refuses or fails to pay, you remain responsible for the outstanding delivery fee."}
          </Text>
        </View>

        {/* Payment Summary */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Transportation</Text>

            <Text style={styles.value}>
              {getTransportLabel(transportationType)}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Operational Fee</Text>

            <Text style={styles.value}>
              ₦{Number(operationalFare || 0).toLocaleString()}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Platform Fee</Text>

            <Text style={styles.value}>
              ₦{Number(platformFee || 0).toLocaleString()}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>VAT</Text>

            <Text style={styles.value}>
              ₦{Number(vatAmount || 0).toLocaleString()}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.totalLabel}>Total</Text>

            <Text style={styles.totalValue}>
              ₦{Number(totalPrice || 0).toLocaleString()}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.orderButton}
          onPress={handleOrder}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={styles.orderText}>
                {paymentTiming === "BEFORE_PICKUP" &&
                paymentMethod === "PAYSTACK"
                  ? paymentResponsibility === "RECEIVER"
                    ? "Confirm Delivery Order"
                    : "Proceed to Payment"
                  : "Confirm Delivery Order"}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default Checkout;
