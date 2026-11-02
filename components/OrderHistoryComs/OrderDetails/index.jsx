import * as Clipboard from "expo-clipboard";

import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  Share,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DataStore } from "aws-amplify/datastore";
import { getUrl } from "aws-amplify/storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import Collapsible from "react-native-collapsible";
import PagerView from "react-native-pager-view";
import Placeholder from "../../../assets/images/placeholder.png";
import OrderMap from "./OrderMap";

import { Order, Payment } from "@/src/models";
import styles from "./styles";

/* ========================================================================= */
/* MAIN COMPONENT                                                            */
/* ========================================================================= */

const OrderDetails = ({ orderId: receivedOrderId }) => {
  /* ----------------------------------------------------------------------- */
  /* ROUTE PARAMETER                                                         */
  /* ----------------------------------------------------------------------- */

  const params = useLocalSearchParams();

  const routeOrderId = Array.isArray(params.orderId)
    ? params.orderId[0]
    : params.orderId;

  const orderId = receivedOrderId || routeOrderId;

  /* ----------------------------------------------------------------------- */
  /* STATE                                                                   */
  /* ----------------------------------------------------------------------- */

  const [order, setOrder] = useState(null);
  const [courier, setCourier] = useState(null);
  const [paymentRecord, setPaymentRecord] = useState(null);
  const [paymentLink, setPaymentLink] = useState(null);
  const [loading, setLoading] = useState(true);

  // Always store a resolved image URL string here.
  // Never store the complete Amplify getUrl() response object.
  const [profileImage, setProfileImage] = useState(null);

  const [evidence, setEvidence] = useState([]);

  const [showViewer, setShowViewer] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  const [sections, setSections] = useState({
    recipient: true,
    route: true,
    load: false,
    pricing: false,
    payment: true,
    evidence: false,
  });

  /* ----------------------------------------------------------------------- */
  /* COORDINATES                                                             */
  /* ----------------------------------------------------------------------- */

  const hasValidCoords =
    typeof order?.originLat === "number" &&
    typeof order?.originLng === "number" &&
    typeof order?.destinationLat === "number" &&
    typeof order?.destinationLng === "number";

  /* ========================================================================= */
  /* HELPERS                                                                   */
  /* ========================================================================= */

  /**
   * Copy a value to the clipboard.
   */
  const copyToClipboard = async (text, label = "Copied") => {
    if (text === null || text === undefined || text === "") {
      return;
    }

    try {
      await Clipboard.setStringAsync(String(text));

      Alert.alert(label, "Copied to clipboard");
    } catch (error) {
      console.error("Clipboard error:", error);

      Alert.alert("Copy failed", "Unable to copy this value.");
    }
  };

  /**
   * Build the public recipient tracking URL.
   *
   * The token is generated when payment is verified.
   */
  const getRecipientTrackingUrl = (orderData) => {
    const token = orderData?.recipientTrackingToken;

    if (!token) {
      return null;
    }

    return `https://atuainc.com/send/track/${token}`;
  };

  /**
   * Share the public tracking page with the recipient.
   */
  const shareTrackingLink = async () => {
    const trackingUrl = getRecipientTrackingUrl(order);

    if (!trackingUrl) {
      Alert.alert(
        "Tracking unavailable",
        "The tracking link is not available for this order yet.",
      );

      return;
    }

    try {
      await Share.share({
        title: "Atua Delivery Tracking",
        message: `You can track your Atua delivery here:\n\n${trackingUrl}`,
        url: trackingUrl,
      });
    } catch (error) {
      // Ignore the normal case where the user closes the share sheet.
      if (error?.message !== "User did not share") {
        console.error("Unable to share tracking link:", error);
      }
    }
  };

  /**
   * Copy the public tracking URL to the clipboard.
   */
  const copyTrackingLink = async () => {
    const trackingUrl = getRecipientTrackingUrl(order);

    if (!trackingUrl) {
      Alert.alert(
        "Tracking unavailable",
        "The tracking link is not available for this order yet.",
      );

      return;
    }

    await copyToClipboard(trackingUrl, "Tracking link copied");
  };

  /** Format enum values into readable labels. */
  const formatEnumLabel = (value) => {
    if (!value) {
      return "Not specified";
    }

    return String(value)
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  };

  /** Share a saved Paystack checkout link using the native share sheet. */
  const sharePaymentLink = async () => {
    if (!paymentLink) {
      Alert.alert(
        "Payment link unavailable",
        "No saved payment link was found.",
      );
      return;
    }

    try {
      await Share.share({
        title: "Atua payment link",
        message: `Complete the payment for Atua order #${order?.id || ""}:\n\n${paymentLink}`,
        url: paymentLink,
      });
    } catch (error) {
      if (error?.message !== "User did not share") {
        console.error("Unable to share payment link:", error);
        Alert.alert("Share failed", "Unable to share the payment link.");
      }
    }
  };

  /** Open only a valid HTTPS payment URL. */
  const openPaymentLink = async () => {
    if (!paymentLink) {
      Alert.alert(
        "Payment link unavailable",
        "No saved payment link was found.",
      );
      return;
    }

    try {
      const parsedUrl = new URL(paymentLink);
      if (parsedUrl.protocol !== "https:") {
        throw new Error("Payment link must use HTTPS.");
      }
      await Linking.openURL(parsedUrl.toString());
    } catch (error) {
      console.error("Unable to open payment link:", error);
      Alert.alert(
        "Unable to open link",
        "The saved payment link is invalid or could not be opened.",
      );
    }
  };

  /**
   * Format Nigerian Naira.
   */

  /**
   * Format Nigerian Naira.
   * Uses the correct Naira currency symbol.
   */
  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
      return `₦${String(value)}`;
    }

    return `₦${numericValue.toLocaleString("en-NG")}`;
  };

  /**
   * Format dates in a readable form.
   */
  const formatDate = (value) => {
    if (!value) {
      return "-";
    }

    try {
      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "-";
      }

      return date.toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  /**
   * Safely convert an Amplify Storage path into
   * a string URL usable by React Native Image.
   */
  const getStorageUrlString = async (imagePath) => {
    if (!imagePath) {
      return null;
    }

    // If already a URL, do not call getUrl() again.
    if (
      typeof imagePath === "string" &&
      (imagePath.startsWith("http://") ||
        imagePath.startsWith("https://") ||
        imagePath.startsWith("file://"))
    ) {
      return imagePath;
    }

    try {
      const result = await getUrl({
        path: String(imagePath),
      });

      const resolvedUrl = result?.url;

      if (!resolvedUrl) {
        return null;
      }

      return resolvedUrl.toString();
    } catch (error) {
      console.error("Unable to resolve storage image URL:", error);

      return null;
    }
  };

  /* ========================================================================= */
  /* IMAGE LOADING                                                             */
  /* ========================================================================= */

  /**
   * Load courier profile image.
   */
  const loadCourierImage = async (imagePath, isMounted = true) => {
    try {
      if (!imagePath) {
        if (isMounted) {
          setProfileImage(null);
        }

        return;
      }

      const imageUrl = await getStorageUrlString(imagePath);

      if (!isMounted) {
        return;
      }

      setProfileImage(imageUrl || null);
    } catch (error) {
      console.error("Error loading courier profile image:", error);

      if (isMounted) {
        setProfileImage(null);
      }
    }
  };

  /**
   * Load all delivery evidence images.
   *
   * Supports:
   * - String Storage paths
   * - { path: "..." }
   * - { key: "..." }
   * - { uri: "..." }
   */
  const loadEvidence = async (orderData, isMounted = true) => {
    try {
      if (!orderData) {
        if (isMounted) {
          setEvidence([]);
        }

        return;
      }

      const groups = [
        orderData.senderPreTransferPhotos || [],
        orderData.courierPreTransferPhotos || [],
        orderData.courierPostLoadingPhotos || [],
        orderData.dropoffArrivalPhotos || [],
        orderData.postDeliveryPhotos || [],
      ];

      const imagePaths = groups
        .flat()
        .filter(Boolean)
        .map((image) => {
          if (typeof image === "string") {
            return image;
          }

          if (typeof image === "object") {
            return image.path || image.key || image.uri || null;
          }

          return null;
        })
        .filter(Boolean);

      const resolvedImages = [];

      for (const imagePath of imagePaths) {
        const imageUrl = await getStorageUrlString(imagePath);

        if (imageUrl) {
          resolvedImages.push({
            uri: imageUrl,
          });
        }
      }

      if (isMounted) {
        setEvidence(resolvedImages);
      }
    } catch (error) {
      console.error("Error loading delivery evidence:", error);

      if (isMounted) {
        setEvidence([]);
      }
    }
  };

  /* ========================================================================= */
  /* FETCH ORDER AND COURIER                                                   */
  /* ========================================================================= */

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!orderId) {
        console.warn("OrderDetails: No orderId was provided.");

        if (isMounted) {
          setOrder(null);
          setCourier(null);
          setPaymentRecord(null);
          setPaymentLink(null);
          setProfileImage(null);
          setEvidence([]);
          setLoading(false);
        }

        return;
      }

      try {
        if (isMounted) {
          setLoading(true);
        }

        /**
         * Fetch order from Amplify DataStore.
         */
        const orderData = await DataStore.query(Order, orderId);

        if (!isMounted) {
          return;
        }

        if (!orderData) {
          setOrder(null);
          setCourier(null);
          setPaymentRecord(null);
          setPaymentLink(null);
          setProfileImage(null);
          setEvidence([]);

          return;
        }

        setOrder(orderData);

        // Find the latest reusable pending Paystack checkout URL for this order.
        // Payment lookup is isolated so a missing/failed payment query does not
        // prevent the rest of the order details from loading.
        try {
          const paymentRecords = await DataStore.query(Payment, (payment) =>
            payment.orderID.eq(orderData.id),
          );

          const reusablePayment = (paymentRecords || [])
            .filter(
              (payment) =>
                payment.provider === "PAYSTACK" &&
                payment.status === "PENDING" &&
                typeof payment.checkoutUrl === "string" &&
                payment.checkoutUrl.startsWith("https://"),
            )
            .sort(
              (a, b) =>
                new Date(b.createdAt || 0).getTime() -
                new Date(a.createdAt || 0).getTime(),
            )[0];

          if (isMounted) {
            setPaymentRecord(reusablePayment || null);
            setPaymentLink(reusablePayment?.checkoutUrl || null);
          }
        } catch (paymentError) {
          console.error("Unable to load payment details:", paymentError);
          if (isMounted) {
            setPaymentRecord(null);
            setPaymentLink(null);
          }
        }

        /**
         * Load assigned courier through the model relationship.
         */
        let courierData = null;

        if (orderData.assignedCourierId) {
          try {
            courierData = await orderData.assignedCourier;
          } catch (relationshipError) {
            console.error(
              "Unable to load assigned courier relationship:",
              relationshipError,
            );
          }
        }

        if (!isMounted) {
          return;
        }

        setCourier(courierData || null);

        /**
         * Load courier profile image.
         *
         * profilePic should contain the Storage path.
         */
        if (courierData?.profilePic) {
          await loadCourierImage(courierData.profilePic, isMounted);
        } else {
          setProfileImage(null);
        }

        /**
         * Load delivery evidence.
         */
        await loadEvidence(orderData, isMounted);
      } catch (error) {
        console.error("Error loading order details:", error);

        if (isMounted) {
          setOrder(null);
          setCourier(null);
          setPaymentRecord(null);
          setPaymentLink(null);
          setProfileImage(null);
          setEvidence([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  /* ========================================================================= */
  /* SECTION TOGGLE                                                            */
  /* ========================================================================= */

  const toggleSection = (key) => {
    setSections((previousSections) => ({
      ...previousSections,
      [key]: !previousSections[key],
    }));
  };

  /* ========================================================================= */
  /* LOADING STATE                                                             */
  /* ========================================================================= */

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F7FB" />

        <ActivityIndicator size="large" color="#2563EB" />

        <Text style={styles.loadingText}>Loading your delivery...</Text>
      </View>
    );
  }

  /* ========================================================================= */
  /* EMPTY STATE                                                               */
  /* ========================================================================= */

  if (!order) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F7FB" />

        <View style={styles.emptyIcon}>
          <Text style={styles.emptyIconText}>!</Text>
        </View>

        <Text style={styles.emptyTitle}>Order not found</Text>

        <Text style={styles.emptyDescription}>
          We could not find the delivery you are looking for.
        </Text>

        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.emptyButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* ========================================================================= */
  /* DERIVED VALUES                                                            */
  /* ========================================================================= */

  const orderReference = order.id
    ? order.id.slice(0, 8).toUpperCase()
    : "--------";

  const courierName =
    [courier?.firstName, courier?.lastName].filter(Boolean).join(" ") ||
    "Courier assigned";

  const isActiveOrder = [
    "READY_FOR_PICKUP",
    "BIDDING",
    "ACCEPTED",
    "IN_TRANSIT",
  ].includes(order.status);

  const isPaid = order?.paymentStatus === "PAID";

  const showCourierPhone = isPaid;

  const isDelivered = order.status === "DELIVERED";

  const isCancelled = ["CANCELLED", "CANCELED"].includes(order.status);

  /* ========================================================================= */
  /* MAIN UI                                                                   */
  /* ========================================================================= */

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FB" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================================= */}
        {/* HEADER                                                             */}
        {/* ================================================================= */}

        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.75}
            >
              <Ionicons name="chevron-back" size={25} color="#071A3D" />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerEyebrow}>DELIVERY DETAILS</Text>

              <Text style={styles.title}>Order #{orderReference}</Text>
            </View>

            <View style={styles.headerLogo}>
              <Ionicons name="cube-outline" size={24} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.headerBottomRow}>
            <View>
              <Text style={styles.headerSubtitle}>
                Your delivery at a glance
              </Text>
            </View>

            <StatusBadge status={order.status} />
          </View>
        </View>

        {/* ================================================================= */}
        {/* DELIVERY OVERVIEW                                                  */}
        {/* ================================================================= */}

        <View style={styles.overviewCard}>
          <View style={styles.overviewTop}>
            <View style={styles.overviewLabelContainer}>
              <View style={styles.liveDot} />

              <Text style={styles.overviewLabel}>
                {isDelivered
                  ? "DELIVERY COMPLETED"
                  : isCancelled
                    ? "DELIVERY CANCELLED"
                    : isActiveOrder
                      ? "DELIVERY IN PROGRESS"
                      : "DELIVERY OVERVIEW"}
              </Text>
            </View>

            <Text style={styles.overviewOrderId}>#{orderReference}</Text>
          </View>

          <View style={styles.overviewTitleRow}>
            <View style={styles.overviewTitleContainer}>
              <Text style={styles.overviewTitle}>
                {isDelivered
                  ? "Your order has arrived"
                  : isCancelled
                    ? "Order cancelled"
                    : "Your delivery is on its way"}
              </Text>

              <Text style={styles.overviewDescription}>
                {isDelivered
                  ? "Thank you for using Atua."
                  : isCancelled
                    ? "This order is no longer active."
                    : "Track your order and stay updated."}
              </Text>
            </View>

            <View style={styles.overviewPackageIcon}>
              <Ionicons name="cube-outline" size={28} color="#071A3D" />
            </View>
          </View>

          {/* MAP */}
          {hasValidCoords && (
            <OrderMap order={order} isDelivered={isDelivered} styles={styles} />
          )}

          {/* ROUTE SUMMARY */}
          <View style={styles.routeSummary}>
            <View style={styles.routeSummaryItem}>
              <View style={styles.routeIconPickup}>
                <View style={styles.routeIconPickupDot} />
              </View>

              <View style={styles.routeSummaryText}>
                <Text style={styles.routeSummaryLabel}>PICKUP FROM</Text>

                <Text style={styles.routeSummaryAddress} numberOfLines={2}>
                  {order.originAddress || "-"}
                </Text>
              </View>
            </View>

            <View style={styles.routeDivider}>
              <View style={styles.routeDividerLine} />
            </View>

            <View style={styles.routeSummaryItem}>
              <View style={styles.routeIconDropoff}>
                <Text style={styles.routeIconDropoffText}>●</Text>
              </View>

              <View style={styles.routeSummaryText}>
                <Text style={styles.routeSummaryLabel}>DELIVERING TO</Text>

                <Text style={styles.routeSummaryAddress} numberOfLines={2}>
                  {order.destinationAddress || "-"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ================================================================= */}
        {/* COURIER PROFILE                                                   */}
        {/* ================================================================= */}

        {courier && (
          <View style={styles.courierCard}>
            <View style={styles.courierCardHeader}>
              <Text style={styles.cardEyebrow}>YOUR COURIER</Text>

              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>✓ Assigned</Text>
              </View>
            </View>

            <View style={styles.courierProfileRow}>
              <View style={styles.courierAvatarContainer}>
                <Image
                  source={
                    typeof profileImage === "string" && profileImage.length > 0
                      ? { uri: profileImage }
                      : Placeholder
                  }
                  style={styles.avatar}
                  resizeMode="cover"
                />

                <View style={styles.onlineIndicator} />
              </View>

              <View style={styles.courierInfo}>
                <Text style={styles.courierName}>{courierName}</Text>

                <Text style={styles.vehicle}>
                  {courier.vehicleClass || "Courier"}{" "}
                  {courier.plateNumber ? `• ${courier.plateNumber}` : ""}
                </Text>

                <Text style={styles.courierSubtext}>Atua delivery partner</Text>
              </View>

              <View style={styles.courierContactButtons}>
                {showCourierPhone && courier.phoneNumber && (
                  <TouchableOpacity
                    style={styles.contactButton}
                    onPress={() =>
                      copyToClipboard(courier.phoneNumber, "Phone copied")
                    }
                    activeOpacity={0.8}
                  >
                    <Ionicons name="call-outline" size={19} color="#087477" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {showCourierPhone && courier.phoneNumber && (
              <TouchableOpacity
                style={styles.phoneCopyRow}
                onPress={() =>
                  copyToClipboard(courier.phoneNumber, "Phone copied")
                }
                activeOpacity={0.7}
              >
                <Text style={styles.phoneCopyLabel}>Courier phone number</Text>

                <View style={styles.phoneCopyRight}>
                  <Text style={styles.phoneCopyNumber}>
                    {courier.phoneNumber}
                  </Text>

                  <Ionicons name="copy-outline" size={18} color="#0A9396" />
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ================================================================= */}
        {/* DELIVERY TIMELINE                                                 */}
        {/* ================================================================= */}

        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <View>
              <Text style={styles.cardEyebrow}>DELIVERY JOURNEY</Text>

              <Text style={styles.sectionCardTitle}>Delivery Timeline</Text>
            </View>

            <View style={styles.timelineHeaderIcon}>
              <Text style={styles.timelineHeaderIconText}>◷</Text>
            </View>
          </View>

          <Timeline
            acceptedAt={order.acceptedAt}
            arrivedPickupAt={order.arrivedPickupAt}
            tripStartedAt={order.tripStartedAt}
            arrivedDropoffAt={order.arrivedDropoffAt}
            unloadingCompletedAt={order.unloadingCompletedAt}
            status={order.status}
          />
        </View>

        {/* ================================================================= */}
        {/* RECIPIENT DETAILS                                                 */}
        {/* ================================================================= */}

        <Section
          title="Recipient Details"
          eyebrow="DELIVERY CONTACT"
          icon="◉"
          open={sections.recipient}
          toggle={() => toggleSection("recipient")}
        >
          <DetailRow label="Full name" value={order.recipientName} />

          <DetailRow
            label="Phone number"
            value={order.recipientNumber}
            copyable
            onCopy={() =>
              copyToClipboard(order.recipientNumber, "Phone copied")
            }
          />

          {order.recipientNumber2 && (
            <DetailRow
              label="Alternative phone"
              value={order.recipientNumber2}
              copyable
              onCopy={() =>
                copyToClipboard(order.recipientNumber2, "Phone copied")
              }
            />
          )}
        </Section>

        {/* ================================================================= */}
        {/* ROUTE DETAILS                                                     */}
        {/* ================================================================= */}

        <Section
          title="Route Details"
          eyebrow="PICKUP & DROPOFF"
          icon="↔"
          open={sections.route}
          toggle={() => toggleSection("route")}
        >
          <DetailRow label="Pickup location" value={order.originAddress} />

          <DetailRow
            label="Dropoff location"
            value={order.destinationAddress}
          />

          <DetailRow label="Trip type" value={order.tripType} />
        </Section>

        {/* ================================================================= */}
        {/* RECIPIENT TRACKING LINK                                           */}
        {/* ================================================================= */}

        {order?.recipientTrackingEnabled &&
          order?.recipientTrackingToken &&
          !order?.recipientTrackingRevokedAt && (
            <View style={styles.trackingLinkCard}>
              {/* CARD HEADER */}
              <View style={styles.trackingLinkHeader}>
                <View style={styles.trackingLinkIcon}>
                  <Ionicons name="navigate-outline" size={21} color="#087477" />
                </View>

                <View style={styles.trackingLinkHeaderText}>
                  <Text style={styles.trackingLinkEyebrow}>
                    RECIPIENT TRACKING
                  </Text>

                  <Text style={styles.trackingLinkTitle}>
                    Share delivery progress
                  </Text>
                </View>
              </View>

              {/* CARD CONTENT */}
              <View style={styles.trackingLinkContent}>
                <Text style={styles.trackingLinkDescription}>
                  Send this link to the recipient so they can follow the
                  delivery without signing into Atua.
                </Text>

                <View style={styles.trackingLinkPreview}>
                  <Text style={styles.trackingLinkText} numberOfLines={2}>
                    {getRecipientTrackingUrl(order)}
                  </Text>
                </View>

                {/* ACTION BUTTONS */}
                <View style={styles.trackingLinkActions}>
                  <TouchableOpacity
                    style={[
                      styles.trackingLinkActionButton,
                      styles.trackingLinkCopyButton,
                    ]}
                    onPress={copyTrackingLink}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.trackingLinkCopyButtonText}>
                      Copy Link
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.trackingLinkActionButton,
                      styles.trackingLinkShareButton,
                    ]}
                    onPress={shareTrackingLink}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.trackingLinkShareButtonText}>
                      Share Link
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

        {/* ================================================================= */}
        {/* PARCEL DETAILS                                                    */}
        {/* ================================================================= */}

        <Section
          title="Parcel Details"
          eyebrow="PACKAGE INFORMATION"
          icon="▣"
          open={sections.load}
          toggle={() => toggleSection("load")}
        >
          <DetailRow label="Load category" value={order.loadCategory} />

          <DetailRow label="Vehicle class" value={order.vehicleClass} />

          <DetailRow label="Weight" value={order.declaredWeightBracket} />

          <DetailRow
            label="Package description"
            value={order.orderDetails}
            multiline
          />

          {order.deliveryVerificationCode && (
            <View style={styles.verificationContainer}>
              <View style={styles.verificationHeader}>
                <Text style={styles.verificationLabel}>
                  DELIVERY VERIFICATION CODE
                </Text>

                <Text style={styles.verificationHint}>Keep this safe</Text>
              </View>

              <TouchableOpacity
                style={styles.verificationCodeBox}
                onPress={() =>
                  copyToClipboard(order.deliveryVerificationCode, "Code copied")
                }
                activeOpacity={0.8}
              >
                <Text style={styles.verificationCode}>
                  {order.deliveryVerificationCode}
                </Text>

                <Text style={styles.verificationCopy}>⧉</Text>
              </TouchableOpacity>
            </View>
          )}
        </Section>

        {/* ================================================================= */}
        {/* PAYMENT AND COLLECTION                                            */}
        {/* ================================================================= */}

        <Section
          title="Payment & Collection"
          eyebrow="PAYMENT INFORMATION"
          icon="₦"
          open={sections.payment}
          toggle={() => toggleSection("payment")}
        >
          <DetailRow
            label="Who pays"
            value={formatEnumLabel(order.paymentResponsibility)}
          />

          <DetailRow
            label="Payment timing"
            value={formatEnumLabel(order.paymentTiming)}
          />

          <DetailRow
            label="Payment method"
            value={formatEnumLabel(order.paymentMethod)}
          />

          <DetailRow
            label="Payment status"
            value={formatEnumLabel(order.paymentStatus)}
          />

          {paymentRecord?.amount !== null &&
            paymentRecord?.amount !== undefined && (
              <DetailRow
                label="Payment amount"
                value={formatCurrency(paymentRecord.amount)}
              />
            )}

          {paymentLink && order.paymentStatus !== "PAID" && (
            <View style={styles.trackingLinkContent}>
              <Text style={styles.trackingLinkEyebrow}>
                SAVED PAYSTACK PAYMENT LINK
              </Text>
              <Text style={styles.trackingLinkDescription}>
                Copy or share this saved link with the person making the
                payment.
              </Text>
              <View style={styles.trackingLinkPreview}>
                <Text style={styles.trackingLinkText} numberOfLines={3}>
                  {paymentLink}
                </Text>
              </View>
              <View style={styles.trackingLinkActions}>
                <TouchableOpacity
                  style={[
                    styles.trackingLinkActionButton,
                    styles.trackingLinkCopyButton,
                  ]}
                  onPress={() =>
                    copyToClipboard(paymentLink, "Payment link copied")
                  }
                  activeOpacity={0.8}
                >
                  <Text style={styles.trackingLinkCopyButtonText}>
                    Copy Payment Link
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.trackingLinkActionButton,
                    styles.trackingLinkShareButton,
                  ]}
                  onPress={sharePaymentLink}
                  activeOpacity={0.8}
                >
                  <Text style={styles.trackingLinkShareButtonText}>
                    Share Link
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.trackingLinkActionButton,
                    styles.trackingLinkShareButton,
                  ]}
                  onPress={openPaymentLink}
                  activeOpacity={0.8}
                >
                  <Text style={styles.trackingLinkShareButtonText}>
                    Open Link
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!paymentLink &&
            order.paymentMethod === "PAYSTACK" &&
            order.paymentStatus !== "PAID" && (
              <Text style={styles.evidenceDescription}>
                No reusable pending payment link was found for this order.
                Generate a link from the payment screen again or verify the
                existing payment attempt.
              </Text>
            )}

          {order.fundsStatus && (
            <DetailRow
              label="Funds status"
              value={formatEnumLabel(order.fundsStatus)}
            />
          )}

          {order.fundsHoldReason && (
            <DetailRow
              label="Funds hold reason"
              value={order.fundsHoldReason}
              multiline
            />
          )}
        </Section>

        {/* ================================================================= */}
        {/* PRICE BREAKDOWN                                                   */}
        {/* ================================================================= */}

        <Section
          title="Price Breakdown"
          eyebrow="PAYMENT SUMMARY"
          icon="₦"
          open={sections.pricing}
          toggle={() => toggleSection("pricing")}
        >
          {order?.initialOfferPrice !== null &&
            order?.initialOfferPrice !== undefined &&
            order?.initialOfferPrice !== "" && (
              <DetailRow
                label="Initial offer"
                value={formatCurrency(order.initialOfferPrice)}
              />
            )}

          {order?.operationalFare !== null &&
            order?.operationalFare !== undefined &&
            order?.operationalFare !== "" && (
              <DetailRow
                label="Operational fare"
                value={formatCurrency(order.operationalFare)}
              />
            )}

          {order?.loadingFee !== null &&
            order?.loadingFee !== undefined &&
            order?.loadingFee !== "" && (
              <DetailRow
                label="Loading fee"
                value={formatCurrency(order.loadingFee)}
              />
            )}

          {order?.unloadingFee !== null &&
            order?.unloadingFee !== undefined &&
            order?.unloadingFee !== "" && (
              <DetailRow
                label="Unloading fee"
                value={formatCurrency(order.unloadingFee)}
              />
            )}

          {order?.platformFee !== null &&
            order?.platformFee !== undefined &&
            order?.platformFee !== "" && (
              <DetailRow
                label="Platform fee"
                value={formatCurrency(order.platformFee)}
              />
            )}

          {order?.vatAmount !== null &&
            order?.vatAmount !== undefined &&
            order?.vatAmount !== "" && (
              <DetailRow label="VAT" value={formatCurrency(order.vatAmount)} />
            )}

          <View style={styles.totalContainer}>
            <View>
              <Text style={styles.totalLabel}>Total Amount</Text>

              <Text style={styles.totalSubtext}>Final delivery cost</Text>
            </View>

            <Text style={styles.total}>
              {formatCurrency(order?.totalPrice)}
            </Text>
          </View>
        </Section>

        {/* ================================================================= */}
        {/* DELIVERY EVIDENCE                                                 */}
        {/* ================================================================= */}

        {evidence.length > 0 && (
          <Section
            title="Delivery Evidence"
            eyebrow="PROOF OF DELIVERY"
            icon="▧"
            open={sections.evidence}
            toggle={() => toggleSection("evidence")}
          >
            <Text style={styles.evidenceDescription}>
              Photos captured during the delivery process. Tap any image to view
              it in full screen.
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.evidenceList}
            >
              {evidence.map((imageSource, index) => (
                <TouchableOpacity
                  key={`${imageSource.uri}-${index}`}
                  onPress={() => {
                    setSelectedImage(index);
                    setShowViewer(true);
                  }}
                  activeOpacity={0.85}
                  style={styles.evidenceItem}
                >
                  <Image
                    source={imageSource}
                    style={styles.evidence}
                    resizeMode="cover"
                  />

                  <View style={styles.evidenceOverlay}>
                    <Text style={styles.evidenceOverlayText}>⌕</Text>
                  </View>

                  <View style={styles.evidenceNumber}>
                    <Text style={styles.evidenceNumberText}>{index + 1}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Section>
        )}

        {/* ================================================================= */}
        {/* ACTIONS                                                           */}
        {/* ================================================================= */}

        <View style={styles.actions}>
          {order.status === "BIDDING" && (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  Alert.alert(
                    "View Bids",
                    "The View Bids screen has not been connected yet.",
                  );
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>View Bids</Text>

                <Text style={styles.primaryButtonArrow}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  Alert.alert(
                    "Cancel Order",
                    "The cancel order action has not been connected yet.",
                  );
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryButtonText}>Cancel Order</Text>
              </TouchableOpacity>
            </>
          )}

          {isActiveOrder && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() =>
                router.push(`/screens/orderTrackingScreen/${order.id}`)
              }
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Track Order</Text>

              <Text style={styles.primaryButtonArrow}>↗</Text>
            </TouchableOpacity>
          )}

          {isDelivered && (
            <View style={styles.completedBanner}>
              <View style={styles.completedBannerIcon}>
                <Text style={styles.completedBannerIconText}>✓</Text>
              </View>

              <View style={styles.completedBannerText}>
                <Text style={styles.completedBannerTitle}>
                  Delivery Complete
                </Text>

                <Text style={styles.completedBannerSubtitle}>
                  Your order has been successfully delivered.
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* =================================================================== */}
      {/* FULLSCREEN IMAGE VIEWER                                             */}
      {/* =================================================================== */}

      <Modal
        visible={showViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowViewer(false)}
        statusBarTranslucent
      >
        <View style={styles.viewerContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />

          <View style={styles.viewerHeader}>
            <View>
              <Text style={styles.viewerEyebrow}>DELIVERY EVIDENCE</Text>

              <Text style={styles.viewerCounter}>
                {selectedImage + 1} / {evidence.length}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.close}
              onPress={() => setShowViewer(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closeText}>x</Text>
            </TouchableOpacity>
          </View>

          {evidence.length > 0 && (
            <PagerView
              style={styles.viewerPager}
              initialPage={Math.min(selectedImage, evidence.length - 1)}
              onPageSelected={(event) =>
                setSelectedImage(event.nativeEvent.position)
              }
            >
              {evidence.map((imageSource, index) => (
                <View
                  key={`${imageSource.uri}-viewer-${index}`}
                  style={styles.viewerPage}
                >
                  <Image
                    source={imageSource}
                    style={styles.viewerImage}
                    resizeMode="contain"
                  />
                </View>
              ))}
            </PagerView>
          )}

          <View style={styles.viewerFooter}>
            <Text style={styles.viewerFooterText}>
              Swipe to view more evidence
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

/* ========================================================================= */
/* STATUS BADGE                                                              */
/* ========================================================================= */

const StatusBadge = ({ status }) => {
  const statusConfig = {
    BIDDING: {
      label: "Bidding",
      color: "#B54708",
      background: "#FFFAEB",
      dot: "#F79009",
    },

    READY_FOR_PICKUP: {
      label: "Ready for pickup",
      color: "#175CD3",
      background: "#EFF8FF",
      dot: "#2E90FA",
    },

    ACCEPTED: {
      label: "Accepted",
      color: "#175CD3",
      background: "#EFF8FF",
      dot: "#2E90FA",
    },

    IN_TRANSIT: {
      label: "In transit",
      color: "#175CD3",
      background: "#EFF8FF",
      dot: "#2E90FA",
    },

    DELIVERED: {
      label: "Delivered",
      color: "#027A48",
      background: "#ECFDF3",
      dot: "#12B76A",
    },

    CANCELLED: {
      label: "Cancelled",
      color: "#B42318",
      background: "#FEF3F2",
      dot: "#F04438",
    },

    CANCELED: {
      label: "Cancelled",
      color: "#B42318",
      background: "#FEF3F2",
      dot: "#F04438",
    },
  };

  const config = statusConfig[status] || {
    label: String(status || "Unknown")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase()),

    color: "#475467",
    background: "#F2F4F7",
    dot: "#98A2B3",
  };

  return (
    <View
      style={[
        styles.statusBadge,
        {
          backgroundColor: config.background,
        },
      ]}
    >
      <View
        style={[
          styles.statusBadgeDot,
          {
            backgroundColor: config.dot,
          },
        ]}
      />

      <Text
        style={[
          styles.statusBadgeText,
          {
            color: config.color,
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
};

/* ========================================================================= */
/* TIMELINE                                                                  */
/* ========================================================================= */

const Timeline = ({
  acceptedAt,
  arrivedPickupAt,
  tripStartedAt,
  arrivedDropoffAt,
  unloadingCompletedAt,
  status,
}) => {
  const steps = [
    {
      label: "Order accepted",
      description: "Your delivery request was accepted.",
      value: acceptedAt,
    },
    {
      label: "Arrived at pickup",
      description: "Courier arrived at the pickup location.",
      value: arrivedPickupAt,
    },
    {
      label: "Trip started",
      description: "Your parcel is on its way.",
      value: tripStartedAt,
    },
    {
      label: "Arrived at dropoff",
      description: "Courier reached the destination.",
      value: arrivedDropoffAt,
    },
    {
      label: "Delivered",
      description: "Your parcel has been delivered.",
      value: unloadingCompletedAt,
    },
  ];

  const getCompleted = (index) => {
    if (status === "CANCELLED" || status === "CANCELED") {
      return false;
    }

    if (status === "DELIVERED") {
      return true;
    }

    return Boolean(steps[index].value);
  };

  return (
    <View style={styles.timeline}>
      {steps.map((step, index) => {
        const completed = getCompleted(index);
        const isLast = index === steps.length - 1;

        return (
          <View key={step.label} style={styles.timelineItem}>
            <View style={styles.timelineRail}>
              <View
                style={[
                  styles.timelineDot,
                  completed
                    ? styles.timelineDotCompleted
                    : styles.timelineDotPending,
                ]}
              >
                {completed && <Text style={styles.timelineCheck}>✓</Text>}
              </View>

              {!isLast && (
                <View
                  style={[
                    styles.timelineLine,
                    completed
                      ? styles.timelineLineCompleted
                      : styles.timelineLinePending,
                  ]}
                />
              )}
            </View>

            <View style={styles.timelineContent}>
              <View style={styles.timelineTitleRow}>
                <Text
                  style={[
                    styles.timelineLabel,
                    !completed && styles.timelineLabelPending,
                  ]}
                >
                  {step.label}
                </Text>

                {completed && (
                  <Text style={styles.timelineCompletedText}>Done</Text>
                )}
              </View>

              <Text style={styles.timelineDescription}>{step.description}</Text>

              <Text style={styles.timelineTime}>
                {formatTimelineDate(step.value)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

/* ========================================================================= */
/* COLLAPSIBLE SECTION                                                       */
/* ========================================================================= */

const Section = ({ title, eyebrow, icon, open, toggle, children }) => {
  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.75}
        style={styles.sectionHeader}
      >
        <View style={styles.sectionHeaderIcon}>
          <Text style={styles.sectionHeaderIconText}>{icon}</Text>
        </View>

        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.cardEyebrow}>{eyebrow}</Text>

          <Text style={styles.sectionTitle}>{title}</Text>
        </View>

        <View
          style={[styles.chevronContainer, open && styles.chevronContainerOpen]}
        >
          <Text style={styles.chevron}>{open ? "-" : "+"}</Text>
        </View>
      </TouchableOpacity>

      <Collapsible collapsed={!open} align="top">
        <View style={styles.sectionContent}>{children}</View>
      </Collapsible>
    </View>
  );
};

/* ========================================================================= */
/* DETAIL ROW                                                                */
/* ========================================================================= */

const DetailRow = ({
  label,
  value,
  copyable = false,
  onCopy,
  multiline = false,
}) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  let safeValue = value;

  if (typeof value === "object") {
    try {
      safeValue = JSON.stringify(value);
    } catch {
      safeValue = String(value);
    }
  }

  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>

      <View style={styles.detailValueContainer}>
        <Text
          style={[styles.detailValue, multiline && styles.detailValueMultiline]}
        >
          {String(safeValue)}
        </Text>

        {copyable && (
          <TouchableOpacity
            onPress={onCopy}
            style={styles.detailCopyButton}
            activeOpacity={0.7}
          >
            <Text style={styles.detailCopyIcon}>⧉</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

/* ========================================================================= */
/* DATE FORMATTER                                                            */
/* ========================================================================= */

const formatTimelineDate = (value) => {
  if (!value) {
    return "Pending";
  }

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Pending";
    }

    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Pending";
  }
};

/* ========================================================================= */
/* EXPORT                                                                    */
/* ========================================================================= */

export default OrderDetails;
