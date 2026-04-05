import { freightPricingEngine } from "@/modules/freightPricingEngine";
import { useLocationContext } from "@/providers/LocationProvider";
import { useOrderContext } from "@/providers/OrderProvider";
import { getTransportLabel } from "@/utils/transportFormatter";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CameraCapture from "./CameraCapture";
import MediaPreviewModal from "./MediaPreviewModal/MediaPreviewModal";
import styles from "./styles";
import VideoThumbnail from "./VideoThumbnail";

// I should note that I take platform fee and VAT, and all these are not calculated yet, when the user sends initialofferprice, so if the courier counters it, he is countering with what he expect to go home with, lets say 80% or 75%, if/when he counter, what should I show the courier to pay, because, i think it can't be the exact amount (the amount the courier countered with), because if the user accepts, then it shortening what is meant is meant to be calculated. I think I am not sure

export default function MaxiReviewScreen() {
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState(null);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const {
    recipientName,
    recipientNumber,
    recipientNumber2,
    orderDetails,
    loadingFee,
    unloadingFee,
    pickupLoadingResponsibility,
    dropoffUnloadingResponsibility,
    pickupFloorLevel,
    pickupFloorLevelPrice,
    pickupHasElevator,
    dropoffFloorLevel,
    dropoffFloorLevelPrice,
    dropoffHasElevator,
    loadCategory,
    declaredWeightBracket,
    transportationType,
    vehicleClass,
    estimatedMinPrice,
    setEstimatedMinPrice,
    estimatedMaxPrice,
    setEstimatedMaxPrice,
    initialOfferPrice,
    setInitialOfferPrice,
    senderPreTransferPhotos,
    setSenderPreTransferPhotos,
    senderPreTransferVideo,
    setSenderPreTransferVideo,
    senderPreTransferRecordedAt,
    setSenderPreTransferRecordedAt,
  } = useOrderContext();

  const {
    originAddress,
    destinationAddress,
    originState,
    destinationState,
    totalKm,
    isInterState,
    tripType,
    setTripType,
  } = useLocationContext();

  const pickupSurcharge =
    pickupLoadingResponsibility === "Handle Myself"
      ? 0
      : pickupHasElevator
        ? 0
        : pickupFloorLevelPrice || 0;

  const dropoffSurcharge =
    dropoffUnloadingResponsibility === "Handle Myself"
      ? 0
      : dropoffHasElevator
        ? 0
        : dropoffFloorLevelPrice || 0;

  const floorSurcharge = pickupSurcharge + dropoffSurcharge;

  // useEffect to set tripType
  useEffect(() => {
    setTripType(isInterState ? "INTERSTATE" : "INTRASTATE");
  }, [isInterState, setTripType]);

  // useEffect for calculation
  useEffect(() => {
    if (!vehicleClass || !totalKm) return;

    const result = freightPricingEngine({
      type: vehicleClass,
      distanceKm: Number(totalKm),
      loadCategory,
      isInterState,
      loadingFee,
      unloadingFee,
      floorSurcharge,
    });

    if (!result) return;

    setEstimatedMinPrice(result.minSuggested);
    setEstimatedMaxPrice(result.maxSuggested);

    // Default offer = midpoint
    const midpoint = Math.round(
      (result.minSuggested + result.maxSuggested) / 2,
    );

    setInitialOfferPrice(midpoint);
  }, [
    vehicleClass,
    totalKm,
    loadCategory,
    isInterState,
    loadingFee,
    unloadingFee,
    pickupFloorLevel,
    dropoffFloorLevel,
    pickupHasElevator,
    dropoffHasElevator,
    floorSurcharge,
  ]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Review Freight Order</Text>

        {/* TRIP DETAILS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Trip Details</Text>

          <Text style={styles.value}>Trip Type: {tripType}</Text>

          <Text style={styles.value}>Distance: {totalKm}km</Text>

          <Text style={styles.value}>
            Origin:{" "}
            {originAddress?.data?.description ||
              originAddress?.details?.formatted_address ||
              "Not selected"}
          </Text>

          <Text style={styles.value}>Origin State: {originState}</Text>

          <Text style={styles.value}>
            Destination:{" "}
            {destinationAddress?.data?.description ||
              destinationAddress?.details?.formatted_address ||
              "Not selected"}
          </Text>

          <Text style={styles.value}>
            Destination State: {destinationState}
          </Text>
        </View>

        {/* TRANSPORTATION */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Transportation</Text>

          <Text style={styles.value}>Type: {transportationType}</Text>

          <Text style={styles.value}>
            Vehicle: {getTransportLabel(vehicleClass)}
          </Text>
        </View>

        {/* CARGO */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Cargo</Text>
          <Text style={styles.value}>Category: {loadCategory}</Text>
          <Text style={styles.value}>Weight: {declaredWeightBracket}</Text>
          <Text style={styles.value}>Description: {orderDetails}</Text>
        </View>

        {/* LOADING */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Loading & Floors</Text>

          <Text style={styles.value}>
            Pickup Loading Responsibility:{" "}
            {pickupLoadingResponsibility || "Not selected"}
          </Text>
          <Text style={styles.value}>
            Pickup Loading Fee: ₦{loadingFee?.toLocaleString()}
          </Text>

          <Text style={styles.value}>
            Dropoff Unloading Responsibility:{" "}
            {dropoffUnloadingResponsibility || "Not selected"}
          </Text>

          <Text style={styles.value}>
            Dropoff Unloading Fee: ₦{unloadingFee?.toLocaleString()}
          </Text>

          <Text style={styles.value}>
            Pickup Floor: {pickupFloorLevel} (₦
            {pickupFloorLevelPrice?.toLocaleString()}) | Elevator:{" "}
            {pickupHasElevator ? "Yes" : "No"}
          </Text>
          <Text style={styles.value}>
            Dropoff Floor: {dropoffFloorLevel} (₦
            {dropoffFloorLevelPrice?.toLocaleString()}) | Elevator:{" "}
            {dropoffHasElevator ? "Yes" : "No"}
          </Text>
        </View>

        {/* RECIPIENT */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recipient</Text>
          <Text style={styles.value}>{recipientName}</Text>
          <Text style={styles.value}>{recipientNumber}</Text>
          <Text style={styles.value}>{recipientNumber2}</Text>
        </View>

        {/* PRICE SUMMARY */}
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Suggested Price Range</Text>

          <Text style={styles.priceRange}>
            ₦{estimatedMinPrice?.toLocaleString()} - ₦
            {estimatedMaxPrice?.toLocaleString()}
          </Text>

          <Text style={styles.subLabel}>
            Set your initial offer within this range
          </Text>

          <View style={styles.offerControl}>
            <TouchableOpacity
              style={styles.adjustBtn}
              onPress={() =>
                setInitialOfferPrice((prev) =>
                  Math.max(estimatedMinPrice, prev - 1000),
                )
              }
            >
              <Text style={styles.adjustText}>-</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.offerInput}
              keyboardType="numeric"
              value={initialOfferPrice?.toString()}
              onChangeText={(value) => setInitialOfferPrice(Number(value))}
            />

            <TouchableOpacity
              style={styles.adjustBtn}
              onPress={() =>
                setInitialOfferPrice((prev) =>
                  Math.min(estimatedMaxPrice, prev + 1000),
                )
              }
            >
              <Text style={styles.adjustText}>+</Text>
            </TouchableOpacity>
          </View>
          {initialOfferPrice < estimatedMinPrice ||
          initialOfferPrice > estimatedMaxPrice ? (
            <Text style={{ color: "#EF4444", marginTop: 6 }}>
              Offer must be within suggested range
            </Text>
          ) : null}

          <Text style={styles.helperText}>
            Couriers will bid around your offer
          </Text>
        </View>

        {/* PHOTO UPLOAD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Capture Cargo Photos</Text>

          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => {
              setCameraMode("photo");
              setShowCamera(true);
            }}
          >
            <Text style={styles.uploadText}>Capture Photo</Text>
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {senderPreTransferPhotos?.map((p, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  setSelectedIndex(index);
                  setPreviewVisible(true);
                }}
              >
                <Image source={{ uri: p.uri }} style={styles.previewImage} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* VIDEO UPLOAD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Capture Cargo Video</Text>

          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => {
              setCameraMode("video");
              setShowCamera(true);
            }}
          >
            <Text style={styles.uploadText}>
              {senderPreTransferVideo ? "Re-record Video" : "Record Video"}
            </Text>
          </TouchableOpacity>

          {senderPreTransferVideo?.uri && (
            <TouchableOpacity
              style={styles.videoPreview}
              onPress={() => {
                const videoIndex = senderPreTransferPhotos?.length || 0;
                setSelectedIndex(videoIndex);
                setPreviewVisible(true);
              }}
            >
              <VideoThumbnail
                uri={senderPreTransferVideo.uri}
                style={styles.videoThumbnail}
              />
              <View style={styles.playOverlay}>
                <Ionicons name="play" size={28} color="#FFF" />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* CAMERA MODAL */}
      <Modal
        visible={showCamera}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <CameraCapture
          mode={cameraMode}
          onClose={() => setShowCamera(false)}
          onPhotoCaptured={(photo) => {
            setSenderPreTransferPhotos((prev) => [...(prev || []), photo]);
            setSenderPreTransferRecordedAt(photo.recordedAt);
          }}
          onVideoCaptured={(video) => {
            setSenderPreTransferVideo(video);
            setSenderPreTransferRecordedAt(video.recordedAt);
          }}
        />
      </Modal>

      {/* Preview Modal */}
      <MediaPreviewModal
        visible={previewVisible}
        mediaList={[
          ...(senderPreTransferPhotos || []).map((p) => ({
            ...p,
            type: "photo",
          })),
          ...(senderPreTransferVideo
            ? [{ ...senderPreTransferVideo, type: "video" }]
            : []),
        ]}
        initialIndex={selectedIndex}
        onClose={() => setPreviewVisible(false)}
        onDelete={(index) => {
          const photos = [...(senderPreTransferPhotos || [])];

          if (index < photos.length) {
            photos.splice(index, 1);
            setSenderPreTransferPhotos(photos);
          } else {
            setSenderPreTransferVideo(null);
          }
        }}
      />
    </SafeAreaView>
  );
}
