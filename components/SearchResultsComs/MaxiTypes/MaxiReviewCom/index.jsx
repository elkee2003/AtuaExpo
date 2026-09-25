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

  useEffect(() => {
    setTripType(isInterState ? "INTERSTATE" : "INTRASTATE");
  }, [isInterState, setTripType]);

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

  const origin =
    originAddress?.data?.description ||
    originAddress?.details?.formatted_address ||
    "Not selected";

  const destination =
    destinationAddress?.data?.description ||
    destinationAddress?.details?.formatted_address ||
    "Not selected";

  const isOfferInvalid =
    initialOfferPrice < estimatedMinPrice ||
    initialOfferPrice > estimatedMaxPrice;

  const formatCurrency = (value) => `₦${Number(value || 0).toLocaleString()}`;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* =========================================================
            HEADER
        ========================================================= */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="document-text-outline" size={20} color="#F97316" />
          </View>

          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>ORDER REVIEW</Text>

            <Text style={styles.title}>Review Freight Order</Text>

            <Text style={styles.subtitle}>
              Confirm the details of your shipment before continuing.
            </Text>
          </View>
        </View>

        {/* =========================================================
            TRIP OVERVIEW
        ========================================================= */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="navigate-outline" size={17} color="#F97316" />
            </View>

            <View>
              <Text style={styles.sectionTitle}>Trip Overview</Text>
              <Text style={styles.sectionSubtitle}>
                Route and journey information
              </Text>
            </View>
          </View>

          <View style={styles.routeContainer}>
            {/* Origin */}
            <View style={styles.locationRow}>
              <View style={styles.locationIndicator}>
                <View style={styles.originDot} />
              </View>

              <View style={styles.locationContent}>
                <Text style={styles.fieldLabel}>PICKUP</Text>

                <Text style={styles.fieldValue}>{origin}</Text>

                <Text style={styles.fieldMeta}>
                  {originState || "State not selected"}
                </Text>
              </View>
            </View>

            <View style={styles.routeLine} />

            {/* Destination */}
            <View style={styles.locationRow}>
              <View style={styles.locationIndicator}>
                <View style={styles.destinationDot} />
              </View>

              <View style={styles.locationContent}>
                <Text style={styles.fieldLabel}>DELIVERY</Text>

                <Text style={styles.fieldValue}>{destination}</Text>

                <Text style={styles.fieldMeta}>
                  {destinationState || "State not selected"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.fieldLabel}>TRIP TYPE</Text>
              <Text style={styles.infoValue}>{tripType || "—"}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.fieldLabel}>DISTANCE</Text>
              <Text style={styles.infoValue}>
                {totalKm ? `${totalKm} km` : "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* =========================================================
            TRANSPORTATION
        ========================================================= */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="car-outline" size={17} color="#F97316" />
            </View>

            <View>
              <Text style={styles.sectionTitle}>Transportation</Text>

              <Text style={styles.sectionSubtitle}>
                Vehicle assigned to this shipment
              </Text>
            </View>
          </View>

          <View style={styles.detailRows}>
            <View style={styles.detailRow}>
              <Text style={styles.fieldLabel}>TRANSPORT TYPE</Text>

              <Text style={styles.fieldValue}>{transportationType || "—"}</Text>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.detailRow}>
              <Text style={styles.fieldLabel}>VEHICLE CLASS</Text>

              <Text style={styles.fieldValue}>
                {getTransportLabel(vehicleClass) || "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* =========================================================
            CARGO
        ========================================================= */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="cube-outline" size={17} color="#F97316" />
            </View>

            <View>
              <Text style={styles.sectionTitle}>Cargo Details</Text>

              <Text style={styles.sectionSubtitle}>
                Information about your shipment
              </Text>
            </View>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.fieldLabel}>CATEGORY</Text>

              <Text style={styles.infoValue}>{loadCategory || "—"}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.fieldLabel}>WEIGHT</Text>

              <Text style={styles.infoValue}>
                {declaredWeightBracket || "—"}
              </Text>
            </View>
          </View>

          <View style={styles.descriptionBox}>
            <Text style={styles.fieldLabel}>DESCRIPTION</Text>

            <Text style={styles.descriptionText}>
              {orderDetails || "No description provided"}
            </Text>
          </View>
        </View>

        {/* =========================================================
            LOADING & HANDLING
        ========================================================= */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="layers-outline" size={17} color="#F97316" />
            </View>

            <View>
              <Text style={styles.sectionTitle}>Loading & Handling</Text>

              <Text style={styles.sectionSubtitle}>
                Pickup, delivery and floor requirements
              </Text>
            </View>
          </View>

          {/* Pickup */}
          <View style={styles.handlingBlock}>
            <View style={styles.handlingHeader}>
              <View style={styles.handlingIcon}>
                <Ionicons name="arrow-up-outline" size={15} color="#F97316" />
              </View>

              <Text style={styles.handlingTitle}>Pickup</Text>
            </View>

            <View style={styles.detailRows}>
              <View style={styles.detailRow}>
                <Text style={styles.fieldLabel}>RESPONSIBILITY</Text>

                <Text style={styles.fieldValue}>
                  {pickupLoadingResponsibility || "Not selected"}
                </Text>
              </View>

              <View style={styles.rowDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.fieldLabel}>LOADING FEE</Text>

                <Text style={styles.moneyValue}>
                  {formatCurrency(loadingFee)}
                </Text>
              </View>

              <View style={styles.rowDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.fieldLabel}>FLOOR</Text>

                <Text style={styles.fieldValue}>{pickupFloorLevel || "—"}</Text>
              </View>

              <View style={styles.rowDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.fieldLabel}>ELEVATOR</Text>

                <Text style={styles.fieldValue}>
                  {pickupHasElevator ? "Available" : "None"}
                </Text>
              </View>
            </View>
          </View>

          {/* Dropoff */}
          <View style={styles.handlingBlock}>
            <View style={styles.handlingHeader}>
              <View style={styles.handlingIcon}>
                <Ionicons name="arrow-down-outline" size={15} color="#F97316" />
              </View>

              <Text style={styles.handlingTitle}>Drop-off</Text>
            </View>

            <View style={styles.detailRows}>
              <View style={styles.detailRow}>
                <Text style={styles.fieldLabel}>RESPONSIBILITY</Text>

                <Text style={styles.fieldValue}>
                  {dropoffUnloadingResponsibility || "Not selected"}
                </Text>
              </View>

              <View style={styles.rowDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.fieldLabel}>UNLOADING FEE</Text>

                <Text style={styles.moneyValue}>
                  {formatCurrency(unloadingFee)}
                </Text>
              </View>

              <View style={styles.rowDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.fieldLabel}>FLOOR</Text>

                <Text style={styles.fieldValue}>
                  {dropoffFloorLevel || "—"}
                </Text>
              </View>

              <View style={styles.rowDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.fieldLabel}>ELEVATOR</Text>

                <Text style={styles.fieldValue}>
                  {dropoffHasElevator ? "Available" : "None"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* =========================================================
            RECIPIENT
        ========================================================= */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="person-outline" size={17} color="#F97316" />
            </View>

            <View>
              <Text style={styles.sectionTitle}>Recipient</Text>

              <Text style={styles.sectionSubtitle}>
                Delivery contact information
              </Text>
            </View>
          </View>

          <View style={styles.recipientCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {recipientName?.charAt(0)?.toUpperCase() || "R"}
              </Text>
            </View>

            <View style={styles.recipientInfo}>
              <Text style={styles.recipientName}>
                {recipientName || "Recipient"}
              </Text>

              <View style={styles.phoneRow}>
                <Ionicons name="call-outline" size={13} color="#64748B" />

                <Text style={styles.phoneText}>
                  {recipientNumber || "No phone number"}
                </Text>
              </View>

              {recipientNumber2 ? (
                <View style={styles.phoneRow}>
                  <Ionicons name="call-outline" size={13} color="#64748B" />

                  <Text style={styles.phoneText}>{recipientNumber2}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* =========================================================
            PRICE / OFFER
        ========================================================= */}
        <View style={styles.priceCard}>
          <View style={styles.priceHeader}>
            <View>
              <Text style={styles.priceEyebrow}>YOUR OFFER</Text>

              <Text style={styles.priceTitle}>Set your freight price</Text>
            </View>

            <View style={styles.priceIcon}>
              <Ionicons name="cash-outline" size={20} color="#F97316" />
            </View>
          </View>

          <View style={styles.rangeContainer}>
            <Text style={styles.rangeLabel}>SUGGESTED MARKET RANGE</Text>

            <Text style={styles.priceRange}>
              {formatCurrency(estimatedMinPrice)}
              {" — "}
              {formatCurrency(estimatedMaxPrice)}
            </Text>
          </View>

          <Text style={styles.offerDescription}>
            Choose the amount you want to offer. Couriers can review your offer
            and respond with their bids.
          </Text>

          <View style={styles.offerControl}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.adjustBtn}
              onPress={() =>
                setInitialOfferPrice((prev) =>
                  Math.max(estimatedMinPrice, prev - 1000),
                )
              }
            >
              <Ionicons name="remove" size={21} color="#FFFFFF" />
            </TouchableOpacity>

            <View
              style={[
                styles.offerInputContainer,
                isOfferInvalid && styles.offerInputContainerError,
              ]}
            >
              <Text style={styles.currencyPrefix}>₦</Text>

              <TextInput
                style={styles.offerInput}
                keyboardType="numeric"
                value={initialOfferPrice?.toString()}
                onChangeText={(value) => setInitialOfferPrice(Number(value))}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.adjustBtn}
              onPress={() =>
                setInitialOfferPrice((prev) =>
                  Math.min(estimatedMaxPrice, prev + 1000),
                )
              }
            >
              <Ionicons name="add" size={21} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {isOfferInvalid ? (
            <View style={styles.validationContainer}>
              <Ionicons name="alert-circle-outline" size={15} color="#F87171" />

              <Text style={styles.validationText}>
                Offer must be within the suggested range
              </Text>
            </View>
          ) : null}

          <View style={styles.helperContainer}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color="#94A3B8"
            />

            <Text style={styles.helperText}>
              Couriers will bid around your offer.
            </Text>
          </View>
        </View>

        {/* =========================================================
            PHOTO CAPTURE
        ========================================================= */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="camera-outline" size={17} color="#F97316" />
            </View>

            <View style={styles.headerFlex}>
              <Text style={styles.sectionTitle}>Cargo Photos</Text>

              <Text style={styles.sectionSubtitle}>
                Capture the condition of the shipment
              </Text>
            </View>

            {senderPreTransferPhotos?.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {senderPreTransferPhotos.length}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.uploadBtn}
            onPress={() => {
              setCameraMode("photo");
              setShowCamera(true);
            }}
          >
            <View style={styles.uploadIcon}>
              <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
            </View>

            <View style={styles.uploadContent}>
              <Text style={styles.uploadText}>Capture Photo</Text>

              <Text style={styles.uploadSubtext}>
                Add clear photos of the cargo
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={17} color="#94A3B8" />
          </TouchableOpacity>

          {senderPreTransferPhotos?.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mediaRow}
            >
              {senderPreTransferPhotos.map((p, index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.85}
                  onPress={() => {
                    setSelectedIndex(index);
                    setPreviewVisible(true);
                  }}
                  style={styles.photoWrapper}
                >
                  <Image source={{ uri: p.uri }} style={styles.previewImage} />

                  <View style={styles.photoIndex}>
                    <Text style={styles.photoIndexText}>{index + 1}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* =========================================================
            VIDEO CAPTURE
        ========================================================= */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="videocam-outline" size={17} color="#F97316" />
            </View>

            <View style={styles.headerFlex}>
              <Text style={styles.sectionTitle}>Cargo Video</Text>

              <Text style={styles.sectionSubtitle}>
                Record a short video of the shipment
              </Text>
            </View>

            {senderPreTransferVideo && (
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Added</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.uploadBtn}
            onPress={() => {
              setCameraMode("video");
              setShowCamera(true);
            }}
          >
            <View style={styles.uploadIcon}>
              <Ionicons name="videocam-outline" size={18} color="#FFFFFF" />
            </View>

            <View style={styles.uploadContent}>
              <Text style={styles.uploadText}>
                {senderPreTransferVideo ? "Re-record Video" : "Record Video"}
              </Text>

              <Text style={styles.uploadSubtext}>
                {senderPreTransferVideo
                  ? "Replace the existing cargo video"
                  : "Show the condition and size of the cargo"}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={17} color="#94A3B8" />
          </TouchableOpacity>

          {senderPreTransferVideo?.uri && (
            <TouchableOpacity
              activeOpacity={0.9}
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
                <View style={styles.playButton}>
                  <Ionicons name="play" size={20} color="#FFFFFF" />
                </View>

                <Text style={styles.videoPreviewLabel}>Tap to preview</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* =========================================================
          CAMERA MODAL
      ========================================================= */}
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

      {/* =========================================================
          MEDIA PREVIEW
      ========================================================= */}
      <MediaPreviewModal
        visible={previewVisible}
        mediaList={[
          ...(senderPreTransferPhotos || []).map((p) => ({
            ...p,
            type: "photo",
          })),

          ...(senderPreTransferVideo
            ? [
                {
                  ...senderPreTransferVideo,
                  type: "video",
                },
              ]
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
