import Ionicons from "@expo/vector-icons/Ionicons";

import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useEffect, useMemo, useState } from "react";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import styles from "./styles";

//==================================================
// COURIER REVIEW MODAL
//==================================================

const CourierReviewModal = ({
  visible,
  order,
  courier,
  courierImageUrl,
  loading = false,
  error = null,
  onSubmit,
}) => {
  //-----------------------------------------
  // Safe Area
  //-----------------------------------------

  const insets = useSafeAreaInsets();

  //-----------------------------------------
  // State
  //-----------------------------------------

  const [rating, setRating] = useState(null);

  const [comment, setComment] = useState("");

  //-----------------------------------------
  // Reset when order changes
  //-----------------------------------------

  useEffect(() => {
    setRating(null);

    setComment("");
  }, [order?.id]);

  //==================================================
  // COURIER NAME
  //==================================================

  const courierName = useMemo(() => {
    const name = [courier?.firstName, courier?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    return name || courier?.firstName || "Courier";
  }, [courier?.firstName, courier?.lastName]);

  //==================================================
  // TRANSPORT DETAILS
  //==================================================

  const transportDetails = useMemo(() => {
    return [courier?.transportationType, courier?.vehicleClass]
      .filter(Boolean)
      .join(" • ");
  }, [courier?.transportationType, courier?.vehicleClass]);

  //==================================================
  // VEHICLE DETAILS
  //==================================================

  const vehicleDetails = useMemo(() => {
    return [courier?.vehicleColour, courier?.plateNumber]
      .filter(Boolean)
      .join(" • ");
  }, [courier?.vehicleColour, courier?.plateNumber]);

  //==================================================
  // ORDER REFERENCE
  //==================================================

  const orderReference = useMemo(() => {
    if (!order?.id) {
      return "";
    }

    return `#${order.id.slice(-8).toUpperCase()}`;
  }, [order?.id]);

  //==================================================
  // RATING LABEL
  //==================================================

  const ratingLabel = useMemo(() => {
    switch (rating) {
      case 1:
        return "Poor";

      case 2:
        return "Below average";

      case 3:
        return "Good";

      case 4:
        return "Very good";

      case 5:
        return "Excellent";

      default:
        return "Tap a star to rate";
    }
  }, [rating]);

  //==================================================
  // SUBMIT
  //==================================================

  const handleSubmit = () => {
    //-----------------------------------------
    // Rating is mandatory
    //-----------------------------------------

    if (!rating || loading) {
      return;
    }

    //-----------------------------------------
    // Submit
    //-----------------------------------------

    onSubmit?.({
      rating,
      comment,
    });
  };

  //==================================================
  // IMAGE SOURCE
  //==================================================

  const imageSource = courierImageUrl
    ? {
        uri: courierImageUrl,
      }
    : require("../../assets/images/placeholder.png");

  //==================================================
  // RENDER
  //==================================================

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {
        // Intentionally disabled.
        //
        // The review is mandatory and therefore
        // cannot be dismissed using the Android
        // back button.
      }}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modalContainer}>
          {/* =========================================
              HEADER
          ========================================= */}

          <View style={styles.header}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={22} color="#FFFFFF" />
            </View>

            <Text style={styles.headerTitle}>Delivery completed</Text>

            <Text style={styles.headerSubtitle}>
              Your package was delivered successfully.
            </Text>
          </View>

          {/* =========================================
              CONTENT
          ========================================= */}

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* =======================================
                DELIVERY REFERENCE
            ======================================= */}

            {orderReference ? (
              <View style={styles.orderReferenceContainer}>
                <Text style={styles.orderReferenceLabel}>Delivery</Text>

                <Text style={styles.orderReferenceValue}>{orderReference}</Text>
              </View>
            ) : null}

            {/* =======================================
                DELIVERY ROUTE
            ======================================= */}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your delivery</Text>

              <View style={styles.routeContainer}>
                {/* PICKUP */}

                <View style={styles.locationRow}>
                  <View style={styles.locationIconContainer}>
                    <Ionicons name="ellipse" size={10} color="#10B981" />
                  </View>

                  <View style={styles.locationContent}>
                    <Text style={styles.locationLabel}>Pickup</Text>

                    <Text style={styles.locationText} numberOfLines={2}>
                      {order?.originAddress || "Pickup location"}
                    </Text>
                  </View>
                </View>

                {/* CONNECTOR */}

                <View style={styles.routeConnector} />

                {/* DESTINATION */}

                <View style={styles.locationRow}>
                  <View style={styles.locationIconContainer}>
                    <Ionicons name="location" size={14} color="#EF4444" />
                  </View>

                  <View style={styles.locationContent}>
                    <Text style={styles.locationLabel}>Delivered to</Text>

                    <Text style={styles.locationText} numberOfLines={2}>
                      {order?.destinationAddress || "Destination"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* =======================================
                COURIER
            ======================================= */}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your courier</Text>

              <View style={styles.courierCard}>
                {/* IMAGE */}

                <Image source={imageSource} style={styles.courierImage} />

                {/* INFO */}

                <View style={styles.courierInfo}>
                  <Text style={styles.courierName} numberOfLines={1}>
                    {courierName}
                  </Text>

                  {transportDetails ? (
                    <Text style={styles.courierTransport} numberOfLines={1}>
                      {transportDetails}
                    </Text>
                  ) : null}

                  {vehicleDetails ? (
                    <Text style={styles.courierVehicle} numberOfLines={1}>
                      {vehicleDetails}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* =======================================
                RATING
            ======================================= */}

            <View style={styles.ratingSection}>
              <Text style={styles.ratingTitle}>How was your delivery?</Text>

              <Text style={styles.ratingSubtitle}>
                Rate your courier's service
              </Text>

              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const selected = rating >= star;

                  return (
                    <Pressable
                      key={star}
                      style={styles.starButton}
                      onPress={() => setRating(star)}
                      disabled={loading}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`${star} star${star > 1 ? "s" : ""}`}
                      accessibilityState={{
                        selected,
                        disabled: loading,
                      }}
                    >
                      <Ionicons
                        name={selected ? "star" : "star-outline"}
                        size={36}
                        color={selected ? "#F59E0B" : "#D1D5DB"}
                      />
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.ratingValue}>{ratingLabel}</Text>
            </View>

            {/* =======================================
                COMMENT
            ======================================= */}

            <View style={styles.commentSection}>
              <Text style={styles.commentLabel}>
                Tell us about your experience
                <Text style={styles.optionalText}> (optional)</Text>
              </Text>

              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Share anything about the delivery..."
                placeholderTextColor="#9CA3AF"
                multiline
                textAlignVertical="top"
                editable={!loading}
                maxLength={500}
                style={styles.commentInput}
                accessibilityLabel="Optional delivery comment"
              />

              <Text style={styles.characterCount}>{comment.length}/500</Text>
            </View>

            {/* =======================================
                ERROR
            ======================================= */}

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color="#DC2626"
                />

                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* =======================================
                BOTTOM SPACING
            ======================================= */}

            <View style={styles.bottomSpacing} />
          </ScrollView>

          {/* =========================================
              FOOTER
          ========================================= */}

          <View
            style={[
              styles.footer,
              {
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <Pressable
              style={[
                styles.submitButton,
                (!rating || loading) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!rating || loading}
              accessibilityRole="button"
              accessibilityLabel="Submit courier review"
              accessibilityState={{
                disabled: !rating || loading,
              }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text
                    style={[
                      styles.submitButtonText,
                      !rating && styles.submitButtonTextDisabled,
                    ]}
                  >
                    Submit Review
                  </Text>

                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default CourierReviewModal;
