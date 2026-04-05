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
    platformFee,
    deliveryVerificationCode,
    setDeliveryVerificationCode,
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

  // Generate 6 digit verification code
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

  // Function to submit bid
  const handleSubmit = async () => {
    if (submitting) return;

    setSubmitting(true);

    try {
      if (!dbUser?.id) {
        Alert.alert("Error", "User not authenticated");
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

      const verificationCode = await generateVerificationCode();

      setDeliveryVerificationCode(verificationCode);

      // ✅ NEW — capture media before reset
      const mediaPhotos = [...(senderPreTransferPhotos || [])];
      const mediaVideo = senderPreTransferVideo;

      const hasSenderMedia =
        (mediaPhotos && mediaPhotos.length > 0) || mediaVideo?.uri;

      const mediaStatus = hasSenderMedia ? MediaUploadStatus.PENDING : null;

      // 1️⃣ Create order instantly
      const newOrder = await DataStore.save(
        new Order({
          // BASIC INFO
          recipientName,
          recipientNumber,
          recipientNumber2,
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

          // PRICING
          loadCategory,
          isInterState,

          estimatedMinPrice: parseFloat(estimatedMinPrice),
          estimatedMaxPrice: parseFloat(estimatedMaxPrice),

          initialOfferPrice: parseFloat(initialOfferPrice),
          // currentOfferPrice: parseFloat(initialOfferPrice),

          // lastOfferBy: "USER",

          loadingFee: parseFloat(loadingFee),
          unloadingFee: parseFloat(unloadingFee),

          platformFee: parseFloat(platformFee),

          // VERIFICATION
          deliveryVerificationCode: verificationCode,

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

      Alert.alert(
        "Success",
        `Order created. Verification Code: ${verificationCode}`,
      );

      // Navigate
      router.push(`/screens/orderTrackingScreen/${newOrder.id}`);

      // 2️⃣ Upload evidence in background
      if (hasSenderMedia) {
        setTimeout(() => {
          uploadEvidence(newOrder, mediaPhotos, mediaVideo);
        }, 0);
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
