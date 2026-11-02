import { Ionicons } from "@expo/vector-icons";
import { generateClient } from "aws-amplify/api";
import { DataStore } from "aws-amplify/datastore";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Order } from "@/src/models";
import styles from "./styles";

const client = generateClient();

/**
 * Existing payment flow:
 * Receiver pays before pickup using Paystack.
 */
const INITIALIZE_PAYMENT = /* GraphQL */ `
  mutation InitializeAtuaPayment($orderId: ID!, $payerPhone: String) {
    initializeAtuaPayment(orderId: $orderId, payerPhone: $payerPhone) {
      success
      message
      orderId
      paymentId
      reference
      checkoutUrl
      amount
      currency
      paymentResponsibility
    }
  }
`;

/**
 * Separate payment flow:
 * Receiver pays on delivery.
 *
 * Link generation is optional for this arrangement.
 * This mutation must exist in the AppSync schema.
 */

const INITIALIZE_DELIVERY_PAYMENT = /* GraphQL */ `
  mutation InitializeDeliveryPayment($orderId: ID!, $payerPhone: String) {
    initializeDeliveryPayment(orderId: $orderId, payerPhone: $payerPhone) {
      success
      message
      orderId
      paymentId
      reference
      checkoutUrl
      amount
    }
  }
`;

const formatCurrency = (amount, currency = "NGN") => {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return "₦0.00";
  }

  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `₦${value.toLocaleString("en-NG")}`;
  }
};

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{String(value || "Not provided")}</Text>
  </View>
);

const isPaid = (order) =>
  ["PAID", "SUCCESSFUL"].includes(
    String(order?.paymentStatus || "").toUpperCase(),
  );

/**
 * Only accept secure HTTPS checkout URLs.
 */
const isValidCheckoutUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
};

const ReceiverPayment = () => {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();

  const resolvedOrderId = Array.isArray(orderId) ? orderId[0] : orderId;

  const [order, setOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [error, setError] = useState("");

  /**
   * Load the order from Amplify DataStore.
   */
  const loadOrder = useCallback(async () => {
    if (!resolvedOrderId) {
      setOrder(null);
      setError("The order ID is missing.");
      setLoadingOrder(false);
      return;
    }

    setLoadingOrder(true);
    setError("");
    setCheckoutUrl("");

    try {
      const result = await DataStore.query(Order, resolvedOrderId);

      if (!result) {
        setOrder(null);
        setError(
          "This order could not be found. Please return to your orders and try again.",
        );
        return;
      }

      setOrder(result);
    } catch (err) {
      console.error("ReceiverPayment: load order failed", err);

      setOrder(null);
      setError("Unable to load this order. Please try again.");
    } finally {
      setLoadingOrder(false);
    }
  }, [resolvedOrderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  /**
   * Generate a payment link using the correct backend mutation.
   *
   * BEFORE_PICKUP + PAYSTACK:
   *   initializeAtuaPayment
   *
   * RECEIVER + ON_DELIVERY:
   *   initializeDeliveryPayment
   *
   * For receiver-paid on-delivery orders, link generation is optional.
   * The paymentMethod can be CASH, PAYSTACK, or null.
   *
   * Generating a link must not itself mark the order as paid.
   */
  const handleGeneratePaymentLink = async () => {
    setError("");

    if (generatingLink) {
      return;
    }

    if (!order?.id) {
      setError("Order details are not available.");
      return;
    }

    if (order.paymentResponsibility !== "RECEIVER") {
      setError("This order is not configured for receiver payment.");
      return;
    }

    if (isPaid(order)) {
      Alert.alert("Already Paid", "This order has already been paid for.");
      return;
    }

    const timing = String(order.paymentTiming || "").toUpperCase();

    const method = order.paymentMethod
      ? String(order.paymentMethod).toUpperCase()
      : null;

    const beforePickup = timing === "BEFORE_PICKUP" && method === "PAYSTACK";

    // A sender can generate an optional link for any receiver-paid
    // ON_DELIVERY order, including CASH or null paymentMethod.
    const onDelivery = timing === "ON_DELIVERY";

    if (!beforePickup && !onDelivery) {
      setError(
        "This order's payment arrangement is not supported by this screen. Please return to your order details.",
      );
      return;
    }

    setGeneratingLink(true);

    try {
      const query = beforePickup
        ? INITIALIZE_PAYMENT
        : INITIALIZE_DELIVERY_PAYMENT;

      const field = beforePickup
        ? "initializeAtuaPayment"
        : "initializeDeliveryPayment";

      const response = await client.graphql({
        query,
        variables: {
          orderId: order.id,
          payerPhone: order.recipientNumber || undefined,
        },
        authMode: "userPool",
      });

      const result = response?.data?.[field];

      if (!result?.success) {
        throw new Error(
          result?.message || "Unable to generate the payment link.",
        );
      }

      if (!result?.checkoutUrl) {
        throw new Error(
          "The payment service did not return a checkout link. Please try again.",
        );
      }

      if (!isValidCheckoutUrl(result.checkoutUrl)) {
        throw new Error(
          "The payment service returned an invalid or insecure URL.",
        );
      }

      setCheckoutUrl(result.checkoutUrl);

      Alert.alert(
        "Payment Link Generated",
        beforePickup
          ? "Share the link with the receiver. Pickup must wait until payment is verified."
          : "The link is ready to share with the receiver. If they do not pay electronically before delivery, the courier will explain the available payment options. The order is not considered paid until payment is confirmed.",
      );
    } catch (err) {
      console.error("ReceiverPayment: generate link failed", err);

      const message =
        err?.errors?.[0]?.message ||
        err?.message ||
        "Could not generate the payment link. Please try again.";

      setError(message);
    } finally {
      setGeneratingLink(false);
    }
  };

  /**
   * Share the generated payment link.
   */
  const handleShareLink = async () => {
    if (!checkoutUrl || !order?.id) {
      return;
    }

    try {
      await Share.share({
        message:
          `Please complete payment for Atua order ${order.id} ` +
          `using this link:\n${checkoutUrl}`,
      });
    } catch (err) {
      console.error("ReceiverPayment: share failed", err);

      Alert.alert(
        "Sharing Failed",
        "Unable to share the payment link. Please try again.",
      );
    }
  };

  /**
   * Copy the generated payment link.
   */
  const handleCopyLink = async () => {
    if (!checkoutUrl) {
      return;
    }

    try {
      await Clipboard.setStringAsync(checkoutUrl);

      Alert.alert(
        "Link Copied",
        "The payment link has been copied to your clipboard.",
      );
    } catch (err) {
      console.error("ReceiverPayment: copy failed", err);

      Alert.alert(
        "Copy Failed",
        "Unable to copy the link. Please use Share Payment Link.",
      );
    }
  };

  /**
   * Open the secure Paystack checkout.
   */
  const handleOpenCheckout = async () => {
    if (!checkoutUrl || !isValidCheckoutUrl(checkoutUrl)) {
      Alert.alert(
        "Invalid Link",
        "The checkout link is unavailable. Please generate it again.",
      );
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(checkoutUrl);

      if (!canOpen) {
        throw new Error("This device cannot open the checkout URL.");
      }

      await Linking.openURL(checkoutUrl);
    } catch (err) {
      console.error("ReceiverPayment: open checkout failed", err);

      Alert.alert(
        "Unable to Open",
        "Please copy or share the payment link instead.",
      );
    }
  };

  /**
   * Loading state.
   */
  if (loadingOrder) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color="#111827" />

        <Text style={styles.stateText}>Loading order details...</Text>
      </View>
    );
  }

  /**
   * Order not found or unable to load.
   */
  if (!order) {
    return (
      <View style={styles.stateContainer}>
        <View style={styles.stateIcon}>
          <Ionicons name="alert-circle-outline" size={30} color="#B91C1C" />
        </View>

        <Text style={styles.stateTitle}>Unable to Load Order</Text>

        <Text style={styles.errorText}>
          {error || "Order details could not be loaded."}
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back-outline" size={18} color="#FFFFFF" />

          <Text style={styles.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const timing = String(order.paymentTiming || "").toUpperCase();

  const method = order.paymentMethod
    ? String(order.paymentMethod).toUpperCase()
    : null;

  const beforePickup = timing === "BEFORE_PICKUP" && method === "PAYSTACK";

  const alreadyPaid = isPaid(order);

  const paymentDescription = beforePickup
    ? "Generate a payment link and share it with the receiver. The order must not proceed to pickup until payment is verified."
    : "Generating a payment link is optional. You can share it with the receiver so they can pay electronically before delivery. If they have not paid by arrival, the courier will explain the available payment options, including cash or electronic payment. Generating a link does not mark the order as paid.";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back-outline" size={21} color="#111827" />
        </TouchableOpacity>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Receiver Payment</Text>

          <Text style={styles.headerSubtitle}>
            Generate and share a secure payment link.
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!!error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={20} color="#B91C1C" />

            <Text style={styles.errorBannerText}>{error}</Text>

            <TouchableOpacity
              onPress={() => setError("")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Dismiss error"
            >
              <Ionicons name="close" size={18} color="#B91C1C" />
            </TouchableOpacity>
          </View>
        )}

        {/* Amount and order reference */}
        <View style={styles.amountCard}>
          <View style={styles.amountCardTop}>
            <View>
              <Text style={styles.amountLabel}>Amount Due</Text>

              <Text style={styles.amount}>
                {formatCurrency(order.totalPrice)}
              </Text>
            </View>

            <View style={styles.amountIcon}>
              <Ionicons name="wallet-outline" size={25} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.amountCardDivider} />

          <View style={styles.amountFooter}>
            <View style={styles.receiverBadge}>
              <View style={styles.statusDot} />

              <Text style={styles.receiverBadgeText}>
                {alreadyPaid ? "Payment Completed" : "Receiver Pays"}
              </Text>
            </View>

            <Text style={styles.amountFooterText}>Atua order</Text>
          </View>

          <View style={styles.referenceSection}>
            <Text style={styles.referenceLabel}>ORDER REFERENCE</Text>

            <Text selectable style={styles.referenceValue}>
              {order.id}
            </Text>
          </View>
        </View>

        {/* Order summary */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="receipt-outline" size={19} color="#374151" />
            </View>

            <Text style={styles.cardTitle}>Order Summary</Text>
          </View>

          <DetailRow label="Receiver" value={order.recipientName} />

          <DetailRow label="Receiver Phone" value={order.recipientNumber} />

          <DetailRow label="Pickup" value={order.originAddress} />

          <DetailRow label="Destination" value={order.destinationAddress} />

          {!!order.orderDetails && (
            <DetailRow label="Order Details" value={order.orderDetails} />
          )}

          <DetailRow
            label="Payment Timing"
            value={
              timing === "BEFORE_PICKUP"
                ? "Payment before pickup"
                : timing === "ON_DELIVERY"
                  ? "Receiver pays on delivery"
                  : timing === "AT_PICKUP"
                    ? "Payment at pickup"
                    : "Not specified"
            }
          />
        </View>

        {/* Optional payment-link section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="link-outline" size={19} color="#374151" />
            </View>

            <Text style={styles.cardTitle}>Payment Link</Text>
          </View>

          <Text style={styles.description}>{paymentDescription}</Text>

          {alreadyPaid ? (
            <View style={styles.linkReadyBanner}>
              <Ionicons name="checkmark-circle" size={19} color="#15803D" />

              <Text style={styles.linkReadyText}>
                This order is marked as paid.
              </Text>
            </View>
          ) : !checkoutUrl ? (
            <>
              {!beforePickup && (
                <Text style={styles.description}>
                  You do not have to generate a link now. If payment has not
                  been made when the order arrives, the recipient can pay using
                  an available option explained by the courier. You can return
                  to this order later through Order History.
                </Text>
              )}

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  generatingLink && styles.disabledButton,
                ]}
                onPress={handleGeneratePaymentLink}
                disabled={generatingLink}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                {generatingLink ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons name="link-outline" size={19} color="#FFFFFF" />
                )}

                <Text style={styles.primaryButtonText}>
                  {generatingLink
                    ? "Generating Payment Link..."
                    : beforePickup
                      ? "Generate Payment Link"
                      : "Generate Optional Payment Link"}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.linkSection}>
              <View style={styles.linkReadyBanner}>
                <Ionicons name="checkmark-circle" size={19} color="#15803D" />

                <Text style={styles.linkReadyText}>Payment link generated</Text>
              </View>

              <Text style={styles.linkLabel}>Generated payment link</Text>

              <Text selectable style={styles.linkText}>
                {checkoutUrl}
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleShareLink}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Ionicons
                  name="share-social-outline"
                  size={19}
                  color="#FFFFFF"
                />

                <Text style={styles.primaryButtonText}>Share Payment Link</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleCopyLink}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Ionicons name="copy-outline" size={18} color="#111827" />

                <Text style={styles.secondaryButtonText}>Copy Link</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleOpenCheckout}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Ionicons name="open-outline" size={18} color="#111827" />

                <Text style={styles.secondaryButtonText}>
                  Open Payment Checkout
                </Text>
              </TouchableOpacity>

              {!beforePickup && (
                <Text style={styles.description}>
                  Share this link with the receiver if they want to pay
                  electronically. If payment has not been made by delivery, the
                  courier will explain the available payment options.
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Allow the sender to leave and return later */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace("/orderhistory")}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Ionicons name="list-outline" size={18} color="#111827" />

          <Text style={styles.secondaryButtonText}>
            Skip for now — Go to Order History
          </Text>
        </TouchableOpacity>

        {/* Payment safety information */}
        <View style={styles.securityCard}>
          <View style={styles.securityIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={23}
              color="#15803D"
            />
          </View>

          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>Secure payment</Text>

            <Text style={styles.securityText}>
              Payments are processed through Paystack. Generating a link or
              opening checkout does not mean the order has been paid. Atua must
              verify an electronic transaction on the backend before marking the
              order as paid. Cash collection must also be recorded and confirmed
              through the approved flow.
            </Text>
          </View>
        </View>

        <View style={styles.poweredBy}>
          <Ionicons name="lock-closed-outline" size={13} color="#6B7280" />

          <Text style={styles.poweredByText}>
            Secure payments powered by Paystack
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default ReceiverPayment;
