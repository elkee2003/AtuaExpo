import { useAuthContext } from "@/providers/AuthProvider";
import { useLocationContext } from "@/providers/LocationProvider";
import { useOrderContext } from "@/providers/OrderProvider";
import { Order } from "@/src/models";
import { getTransportLabel } from "@/utils/transportFormatter";
import Ionicons from "@expo/vector-icons/Ionicons";
import { DataStore } from "aws-amplify/datastore";
import * as Crypto from "expo-crypto";
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
  const { dbUser } = useAuthContext();
  const [loading, setLoading] = useState(false);

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
    resetAllLocationFields,
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
    deliveryVerificationCode,
    setDeliveryVerificationCode,
    resetAllOrderFields,
  } = useOrderContext();

  // Function to generate verification code
  const generateVerificationCode = async () => {
    const randomBytes = await Crypto.getRandomBytesAsync(4);

    const number =
      (randomBytes[0] << 24) |
      (randomBytes[1] << 16) |
      (randomBytes[2] << 8) |
      randomBytes[3];

    return Math.abs(number % 1000000)
      .toString()
      .padStart(6, "0");
  };

  const handleOrder = async () => {
    try {
      setLoading(true);

      const verificationCode = await generateVerificationCode();

      setDeliveryVerificationCode(verificationCode);

      const order = await DataStore.save(
        new Order({
          recipientName,
          recipientNumber,
          recipientNumber2,
          orderDetails,
          transportationType,
          totalPrice: parseFloat(totalPrice),
          courierEarnings: parseFloat(courierEarnings),
          commissionAmount: parseFloat(commissionAmount),
          platformFee: parseFloat(platformFee),
          platformServiceRevenue: parseFloat(platformServiceRevenue),
          vatAmount: parseFloat(vatAmount),
          platformNetRevenue: parseFloat(platformNetRevenue),
          originAddress: originAddress?.data?.description,
          originState,
          originLat: parseFloat(originLat),
          originLng: parseFloat(originLng),
          destinationAddress: destinationAddress?.data?.description,
          destinationState,
          destinationLat: parseFloat(destinationLat),
          destinationLng: parseFloat(destinationLng),
          tripType,
          isInterState,
          distance: `${totalKm} km`,
          // VERIFICATION
          deliveryVerificationCode: verificationCode,
          userID: dbUser.id,
          status: "READY_FOR_PICKUP",
        }),
      );

      Alert.alert(
        "Success",
        `Your delivery request has been placed. \nVerification Code: ${verificationCode}`,
      );
      resetAllOrderFields();
      resetAllLocationFields();
      router.replace(`/screens/orderTrackingScreen/${order.id}`);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  // useEffect to set tripType
  useEffect(() => {
    setTripType(isInterState ? "INTERSTATE" : "INTRASTATE");
  }, [isInterState, setTripType]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>Review Order</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Recipient Card */}
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

        {/* Route Card */}
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

        {/* Order Details */}
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
            <Text style={styles.value}>₦{operationalFare}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Platform Fee</Text>
            <Text style={styles.value}>₦{platformFee}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>VAT</Text>
            <Text style={styles.value}>₦{vatAmount}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₦{totalPrice}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.orderButton}
          onPress={handleOrder}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={styles.orderText}>Confirm & Place Order</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default Checkout;
