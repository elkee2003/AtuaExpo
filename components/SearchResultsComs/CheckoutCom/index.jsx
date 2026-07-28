import { useAuthContext } from "@/providers/AuthProvider";
import { useLocationContext } from "@/providers/LocationProvider";
import { useOrderContext } from "@/providers/OrderProvider";
import { Order } from "@/src/models";
import { getTransportLabel } from "@/utils/transportFormatter";

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
      // IMPORTANT:
      //
      // At this point:
      //
      // - Customer has NOT paid.
      // - No verification code exists.
      // - Delivery is NOT ready for pickup.
      // - Courier assignment must NOT begin.
      //
      //-------------------------------------

      const order = await DataStore.save(
        new Order({
          //---------------------------------
          // Recipient
          //---------------------------------

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
          // DO NOT SET:
          //---------------------------------
          //
          // deliveryVerificationCode
          // status: READY_FOR_PICKUP
          //
          // verifyAtuaPayment will handle
          // these after successful payment.
          //
          //---------------------------------
        }),
      );

      //-------------------------------------
      // Navigate To Payment
      //-------------------------------------
      //
      // Do NOT reset OrderContext or
      // LocationContext here.
      //
      //-------------------------------------

      router.push({
        pathname: "/screens/payment",

        params: {
          orderId: order.id,
        },
      });
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
              <Text style={styles.orderText}>Continue to Payment</Text>

              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default Checkout;
