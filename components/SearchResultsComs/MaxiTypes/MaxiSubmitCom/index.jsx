import { useAuthContext } from "@/providers/AuthProvider";
import { useLocationContext } from "@/providers/LocationProvider";
import { useOrderContext } from "@/providers/OrderProvider";
import { MediaUploadStatus, Order } from "@/src/models";
import { DataStore } from "aws-amplify/datastore";
import { uploadData } from "aws-amplify/storage";
import * as Crypto from "expo-crypto";
import * as ImageManipulator from "expo-image-manipulator";
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

  // Function to upload photos
  const uploadSenderPhotos = async () => {
    if (!senderPreTransferPhotos?.length) return [];

    const uploaded = [];

    for (const photo of senderPreTransferPhotos) {
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 900 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
        );

        const response = await fetch(manipulated.uri);
        const blob = await response.blob();

        const key = `public/orders/${dbUser.id}/senderPreTransferPhotos/${Crypto.randomUUID()}.jpg`;

        const result = await uploadData({
          path: key,
          data: blob,
          options: { contentType: "image/jpeg" },
        }).result;

        uploaded.push(result.path);
      } catch (err) {
        console.log("Photo upload failed:", err);
      }
    }

    return uploaded;
  };

  // Function to upload video
  const uploadSenderVideo = async () => {
    if (!senderPreTransferVideo?.uri) return null;

    try {
      const response = await fetch(senderPreTransferVideo.uri);
      const blob = await response.blob();

      const key = `public/orders/${dbUser.id}/senderPreTransferVideo/${Crypto.randomUUID()}.mp4`;

      const result = await uploadData({
        path: key,
        data: blob,
        options: { contentType: "video/mp4" },
      }).result;

      return result.path;
    } catch (err) {
      console.log("Video upload failed:", err);
      return null;
    }
  };

  // Upload evidence in background
  const uploadEvidence = async (order) => {
    try {
      // 1️⃣ mark upload started
      await DataStore.save(
        Order.copyOf(order, (updated) => {
          updated.mediaUploadStatus = MediaUploadStatus.UPLOADING;
        }),
      );

      // on the drivers side do it in such a way driver sees "Sender evidence uploading... ". An example:
      // if mediaUploadStatus === PENDING
      //    "Preparing sender evidence..."

      // if mediaUploadStatus === UPLOADING
      //    "Sender evidence uploading..."

      // if mediaUploadStatus === COMPLETE
      //    show photos + video

      // if mediaUploadStatus === FAILED
      //    "Sender evidence failed to upload"

      const [uploadedPhotos, uploadedVideo] = await Promise.all([
        uploadSenderPhotos(),
        uploadSenderVideo(),
      ]);

      // 2️⃣ save uploaded media
      await DataStore.save(
        Order.copyOf(order, (updated) => {
          updated.senderPreTransferPhotos = uploadedPhotos;
          updated.senderPreTransferVideo = uploadedVideo;
          updated.mediaUploadStatus = MediaUploadStatus.COMPLETE;
        }),
      );

      console.log("Evidence upload complete");
    } catch (error) {
      console.log("Evidence upload error", error);

      await DataStore.save(
        Order.copyOf(order, (updated) => {
          updated.mediaUploadStatus = MediaUploadStatus.FAILED;
          // if Failed, Retry Upload button should be shown here or in orderhistory
        }),
      );
    }
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

      const hasSenderMedia =
        (senderPreTransferPhotos && senderPreTransferPhotos.length > 0) ||
        senderPreTransferVideo?.uri;

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
          currentOfferPrice: parseFloat(initialOfferPrice),

          lastOfferBy: "USER",

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
          senderPreTransferRecordedAt:
            senderPreTransferRecordedAt?.toISOString?.() ||
            new Date().toISOString(),

          // RELATION
          userID: dbUser.id,
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
          uploadEvidence(newOrder);
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
