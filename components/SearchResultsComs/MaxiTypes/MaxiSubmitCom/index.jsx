import { freightPricingEngine } from "@/modules/freightPricingEngine";

import { useAuthContext } from "@/providers/AuthProvider";
import { useLocationContext } from "@/providers/LocationProvider";
import { useOrderContext } from "@/providers/OrderProvider";
import { MediaUploadStatus, Offer, Order } from "@/src/models";
import { uploadEvidence } from "@/utils/uploadEvidence";
import { DataStore } from "aws-amplify/datastore";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import MaxiReviewScreen from "../MaxiReviewCom";
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

const MaxiSubmit = () => {
  const [submitting, setSubmitting] = useState(false);
  const { dbUser } = useAuthContext();
  const {
    originAddress,
    originLat,
    originLng,
    destinationAddress,
    destinationLat,
    destinationLng,
    lastDestination,
    originState,
    destinationState,
    totalMins,
    isInterState,
    tripType,
    totalKm,
    resetAllLocationFields,
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
    vehicleClass,
    orders,
    setOrders,
    estimatedMinPrice,
    estimatedMaxPrice,
    initialOfferPrice,
    loadingFee,
    unloadingFee,
    floorSurcharge,
    fragileSurcharge,
    extrasTotal,
    platformFee,
    loadCategory,
    declaredWeightBracket,
    senderPreTransferPhotos,
    senderPreTransferVideo,
    senderPreTransferRecordedAt,
    pickupLoadingResponsibility,
    pickupFloorLevel,
    pickupFloorLevelPrice,
    pickupHasElevator,
    dropoffUnloadingResponsibility,
    dropoffFloorLevel,
    dropoffFloorLevelPrice,
    dropoffHasElevator,
    removeOrder,
    createOrder,
    resetAllOrderFields,
  } = useOrderContext();

  // Function to submit bid
  const handleSubmit = async () => {
    if (submitting) return;

    setSubmitting(true);

    try {
      if (!dbUser?.id) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      if (!senderName?.trim() || senderName.trim().length < 2) {
        Alert.alert("Sender Required", "Please enter the sender's name.");
        return;
      }

      if (!senderNumber || senderNumber.replace(/\D/g, "").length < 11) {
        Alert.alert(
          "Sender Phone Required",
          "Please enter a valid sender phone number with at least 11 digits.",
        );
        return;
      }

      if (!recipientName?.trim() || recipientName.trim().length < 2) {
        Alert.alert("Recipient Required", "Please enter the recipient's name.");
        return;
      }

      if (!recipientNumber || recipientNumber.replace(/\D/g, "").length < 11) {
        Alert.alert(
          "Recipient Phone Required",
          "Please enter a valid recipient phone number with at least 11 digits.",
        );
        return;
      }

      const validPaymentArrangement =
        (paymentResponsibility === "SENDER" &&
          paymentTiming === "BEFORE_PICKUP" &&
          paymentMethod === "PAYSTACK") ||
        (paymentResponsibility === "SENDER" &&
          paymentTiming === "AT_PICKUP" &&
          paymentMethod === "CASH") ||
        (paymentResponsibility === "RECEIVER" &&
          paymentTiming === "ON_DELIVERY" &&
          paymentMethod == null);

      if (!validPaymentArrangement) {
        Alert.alert(
          "Payment Arrangement Required",
          "Please go back and select who will pay for the delivery.",
        );
        return;
      }

      const pricing = freightPricingEngine({
        type: vehicleClass,
        distanceKm: totalKm,
        loadCategory,
        isInterState,
        loadingFee,
        unloadingFee,
        floorSurcharge,
        fragileSurcharge,
      });

      if (!pricing) {
        Alert.alert("Error", "Unable to calculate pricing. Please try again.");
        setSubmitting(false);
        return;
      }

      if (
        initialOfferPrice < estimatedMinPrice ||
        initialOfferPrice > estimatedMaxPrice
      ) {
        Alert.alert(
          "Invalid Offer",
          "Your offer must be within the suggested range.",
        );

        return;
      }

      // ✅ NEW — capture media before reset
      const mediaPhotos = [...(senderPreTransferPhotos || [])];
      const mediaVideo = senderPreTransferVideo;

      const hasSenderMedia =
        (mediaPhotos && mediaPhotos.length > 0) || mediaVideo?.uri;

      const mediaStatus = hasSenderMedia ? MediaUploadStatus.PENDING : null;

      // Generate a delivery verification code at order creation when:
      // 1. The sender is paying cash, OR
      // 2. The receiver is responsible for payment, regardless
      //    of whether they will eventually pay cash or electronically.
      const shouldGenerateVerificationCode =
        paymentMethod === "CASH" || paymentResponsibility === "RECEIVER";

      const deliveryVerificationCode = shouldGenerateVerificationCode
        ? await generateVerificationCode()
        : undefined;

      // 1️⃣ Create order instantly
      const newOrder = await DataStore.save(
        new Order({
          // BASIC INFO

          // REAL customer orders = PRODUCTION
          // Test orders = TEST
          // orderEnvironment: "TEST",
          orderEnvironment: "PRODUCTION",

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

          orderDetails,

          originAddress: originAddress?.data?.description,
          originState,
          originLat: parseFloat(originLat),
          originLng: parseFloat(originLng),

          destinationAddress: destinationAddress?.data?.description,
          destinationState,
          destinationLat: parseFloat(destinationLat),
          destinationLng: parseFloat(destinationLng),

          tripType,
          distance: `${totalKm} km`,

          transportationType,
          vehicleClass,

          status: "BIDDING",

          paymentStatus: "PENDING",

          payoutStatus: "NOT_PAID",

          fundsStatus: "HELD",

          // PRICING
          loadCategory,
          isInterState,

          estimatedMinPrice: parseFloat(estimatedMinPrice),
          estimatedMaxPrice: parseFloat(estimatedMaxPrice),

          initialOfferPrice: parseFloat(initialOfferPrice),

          deliveryVerificationCode,

          // lastOfferBy: "USER",

          loadingFee: pricing.extras.loadingFee,
          unloadingFee: pricing.extras.unloadingFee,
          floorSurcharge: pricing.extras.floorSurcharge,
          fragileSurcharge: pricing.extras.fragileSurcharge,
          extrasTotal: pricing.extrasTotal,

          // WEIGHT
          declaredWeightBracket,

          // LOADING
          pickupLoadingResponsibility,
          pickupFloorLevel,
          pickupFloorLevelPrice,
          pickupHasElevator,

          dropoffUnloadingResponsibility,
          dropoffFloorLevel,
          dropoffFloorLevelPrice,
          dropoffHasElevator,

          // 🔥 CUSTODY EVIDENCE ONLY RECORDED AT
          mediaUploadStatus: mediaStatus,
          // on the drivers side do it in such a way driver sees "Sender evidence uploading..."

          // Save local media paths
          senderPreTransferLocalPhotos: mediaPhotos.map((p) => p.uri),
          senderPreTransferLocalVideo: mediaVideo?.uri || null,
          senderPreTransferRecordedAt:
            senderPreTransferRecordedAt?.toISOString?.() ||
            new Date().toISOString(),

          // RELATION
          userID: dbUser.id,
        }),
      );

      await DataStore.save(
        new Offer({
          orderID: newOrder.id,
          senderType: "USER",
          amount: parseFloat(initialOfferPrice),
          status: "ACTIVE",
        }),
      );

      // ✅ Save order in context
      setOrders(newOrder);

      Alert.alert("Success", "Order created successfully.");

      // Navigate
      router.replace(`/screens/orderTrackingScreen/${newOrder.id}`);

      // 2️⃣ Upload evidence in background

      // Start the upload immediately. Navigation away from this screen
      // does not itself cancel this promise.
      if (hasSenderMedia) {
        void uploadEvidence(newOrder, mediaPhotos, mediaVideo).catch(
          (error) => {
            console.error("Evidence upload failed:", error);
          },
        );
      }

      resetAllOrderFields();
      resetAllLocationFields();
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <MaxiReviewScreen />

      <TouchableOpacity
        style={[styles.submitButton, submitting && { opacity: 0.5 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={styles.submitText}>
          {submitting ? "Submitting..." : "Submit Maxi Request"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default MaxiSubmit;
