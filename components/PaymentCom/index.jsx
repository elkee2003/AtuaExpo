import { useAuthContext } from "@/providers/AuthProvider";
import { useLocationContext } from "@/providers/LocationProvider";
import { useOrderContext } from "@/providers/OrderProvider";
import { verifyAtuaPayment } from "@/src/graphql/mutations";
import { Order } from "@/src/models";

import Ionicons from "@expo/vector-icons/Ionicons";
import { generateClient } from "aws-amplify/api";
import { DataStore } from "aws-amplify/datastore";
import { router, useLocalSearchParams } from "expo-router";

import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { usePaystack } from "react-native-paystack-webview";
import { SafeAreaView } from "react-native-safe-area-context";

import styles from "./styles";

//==================================================
// AMPLIFY GRAPHQL CLIENT
//==================================================

const client = generateClient();

//==================================================
// PAYMENT COMPONENT
//==================================================

const Payment = () => {
  //-----------------------------------------
  // Params
  //-----------------------------------------

  const params = useLocalSearchParams();

  const orderId = Array.isArray(params.orderId)
    ? params.orderId[0]
    : params.orderId;

  //-----------------------------------------
  // Context
  //-----------------------------------------

  const { dbUser } = useAuthContext();

  const { resetAllOrderFields } = useOrderContext();

  const { resetAllLocationFields } = useLocationContext();

  //-----------------------------------------
  // Paystack
  //-----------------------------------------

  const { popup } = usePaystack();

  //-----------------------------------------
  // State
  //-----------------------------------------

  const [order, setOrder] = useState(null);

  const [loadingOrder, setLoadingOrder] = useState(true);

  const [paymentLoading, setPaymentLoading] = useState(false);

  //================================================
  // FETCH ORDER
  //================================================

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoadingOrder(true);

        //-------------------------------------
        // Validate Order ID
        //-------------------------------------

        if (!orderId) {
          throw new Error("Order ID was not provided.");
        }

        //-------------------------------------
        // Get Order
        //-------------------------------------

        const savedOrder = await DataStore.query(Order, orderId);

        if (!savedOrder) {
          throw new Error("Order could not be found.");
        }

        //-------------------------------------
        // Validate Ownership
        //-------------------------------------

        if (savedOrder.userID !== dbUser?.id) {
          throw new Error(
            "You are not authorized to make payment for this order.",
          );
        }

        //-------------------------------------
        // Save Order
        //-------------------------------------

        setOrder(savedOrder);
      } catch (error) {
        console.log("FETCH PAYMENT ORDER ERROR:", error);

        Alert.alert(
          "Unable to Load Payment",
          error?.message || "Something went wrong while loading your order.",
          [
            {
              text: "Go Back",

              onPress: () => router.back(),
            },
          ],
        );
      } finally {
        setLoadingOrder(false);
      }
    };

    //-------------------------------------
    // Wait Until User Exists
    //-------------------------------------

    if (dbUser?.id) {
      fetchOrder();
    }
  }, [orderId, dbUser?.id]);

  //================================================
  // PAYMENT AMOUNT
  //================================================

  const amount = Number(order?.totalPrice || 0);

  const formattedAmount = amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  //================================================
  // FORMAT MONEY
  //================================================

  const formatMoney = (value) => {
    return Number(value || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  //================================================
  // COMPLETE PAYMENT FLOW
  //================================================

  const completePaymentFlow = (paidOrderId) => {
    if (!paidOrderId) {
      return;
    }

    //-------------------------------------
    // Reset Checkout Context
    //-------------------------------------

    resetAllOrderFields();
    resetAllLocationFields();

    //-------------------------------------
    // Go To Order Tracking
    //-------------------------------------

    router.replace(`/screens/orderTrackingScreen/${paidOrderId}`);
  };

  //================================================
  // EXTRACT PAYSTACK REFERENCE
  //================================================

  const getPaymentReference = (response) => {
    return (
      response?.reference ||
      response?.transactionRef?.reference ||
      response?.transactionRef ||
      response?.data?.reference ||
      response?.trxref ||
      null
    );
  };

  //================================================
  // PAYSTACK SUCCESS
  //================================================

  const handleSuccess = async (response) => {
    try {
      setPaymentLoading(true);

      console.log("PAYSTACK SUCCESS RESPONSE:", response);

      //-------------------------------------
      // Extract Paystack Reference
      //-------------------------------------

      const reference = getPaymentReference(response);

      console.log("PAYSTACK REFERENCE:", reference);

      if (!reference) {
        throw new Error(
          "Payment was completed, but the transaction reference could not be found.",
        );
      }

      //-------------------------------------
      // Validate Order
      //-------------------------------------

      if (!order?.id) {
        throw new Error(
          "The order could not be found for payment verification.",
        );
      }

      //-------------------------------------
      // Verify Payment With Atua Backend
      //-------------------------------------
      //
      // IMPORTANT:
      //
      // We do NOT trust Paystack's
      // onSuccess callback by itself.
      //
      // The Lambda:
      //
      // 1. Verifies reference with Paystack
      // 2. Confirms amount
      // 3. Confirms currency
      // 4. Creates Payment
      // 5. Marks Order PAID
      // 6. Sets READY_FOR_PICKUP
      // 7. Generates verification code
      // 8. Saves code to Order
      //
      //-------------------------------------

      console.log("VERIFYING PAYMENT WITH ATUA...");

      const result = await client.graphql({
        query: verifyAtuaPayment,

        variables: {
          orderId: order.id,

          reference,
        },
      });

      console.log("ATUA VERIFICATION RESPONSE:", result);

      //-------------------------------------
      // Extract Verification Result
      //-------------------------------------

      const verification = result?.data?.verifyAtuaPayment;

      console.log("ATUA PAYMENT VERIFICATION:", verification);

      if (!verification) {
        throw new Error(
          "The payment verification service returned an invalid response.",
        );
      }

      //-------------------------------------
      // Verification Failed
      //-------------------------------------

      if (!verification.success || !verification.verified) {
        throw new Error(
          verification.message || "Your payment could not be verified.",
        );
      }

      //-------------------------------------
      // Confirm Correct Order
      //-------------------------------------

      if (verification.orderId && verification.orderId !== order.id) {
        throw new Error("The verified payment does not match this order.");
      }

      //-------------------------------------
      // Get Verification Code
      //-------------------------------------
      //
      // The code was generated by Lambda
      // and saved directly to Order.
      //
      //-------------------------------------

      const verificationCode = verification.deliveryVerificationCode;

      if (!verificationCode) {
        throw new Error(
          "Payment was verified, but the delivery verification code could not be retrieved.",
        );
      }

      // -------------------------------------
      // Log Confirmation
      // -------------------------------------

      console.log("PAYMENT CONFIRMED:", {
        orderId: verification.orderId || order.id,

        // If verifyAtuaPayment created/found the payment details,
        // use its reference. If the webhook processed first and
        // payment is null, we already have the Paystack reference
        // from the successful checkout response.
        reference: verification.payment?.reference || reference,

        // payment can legitimately be null when the webhook
        // processed the transaction first.
        amount: verification.payment?.amount ?? amount,

        alreadyPaid: verification.alreadyPaid,

        deliveryVerificationCode: verificationCode,
      });

      //-------------------------------------
      // Success Alert
      //-------------------------------------

      Alert.alert(
        verification.alreadyPaid ? "Payment Confirmed" : "Payment Successful",

        verification.alreadyPaid
          ? `This payment has already been confirmed.\n\nDelivery Verification Code: ${verificationCode}\n\nKeep this code safe. It will be required to complete your delivery.`
          : `Your payment has been confirmed successfully.\n\nDelivery Verification Code: ${verificationCode}\n\nKeep this code safe. It will be required to complete your delivery.`,

        [
          {
            text: "Continue",

            onPress: () => completePaymentFlow(order.id),
          },
        ],
      );
    } catch (error) {
      console.log("PAYMENT VERIFICATION ERROR:", error);

      //-------------------------------------
      // GraphQL Error
      //-------------------------------------

      const graphQLError = error?.errors?.[0]?.message;

      const message =
        graphQLError || error?.message || "We could not confirm your payment.";

      //-------------------------------------
      // IMPORTANT:
      //
      // Do NOT tell the customer to simply
      // pay again.
      //
      // Paystack may already have charged
      // them even if verification failed
      // because of network/backend issues.
      //
      //-------------------------------------

      Alert.alert(
        "Payment Verification",
        `${message}\n\nIf the payment went through, do not make another payment yet.`,
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  //================================================
  // PAYSTACK CANCEL
  //================================================

  const handleCancel = () => {
    setPaymentLoading(false);

    Alert.alert(
      "Payment Cancelled",
      "The payment was cancelled. You can try again when you're ready.",
    );
  };

  //================================================
  // PAYSTACK ERROR
  //================================================

  const handlePaystackError = (error) => {
    console.log("PAYSTACK WEBVIEW ERROR:", error);

    setPaymentLoading(false);

    Alert.alert(
      "Payment Error",
      "Paystack could not open the payment page. Please check your connection and try again.",
    );
  };

  //================================================
  // PAYSTACK LOADED
  //================================================

  const handlePaystackLoad = (response) => {
    console.log("PAYSTACK CHECKOUT LOADED:", response);
  };

  //================================================
  // START PAYMENT
  //================================================

  const handlePay = () => {
    //-------------------------------------
    // Prevent Multiple Presses
    //-------------------------------------

    if (paymentLoading) {
      return;
    }

    //-------------------------------------
    // Validate Order
    //-------------------------------------

    if (!order?.id) {
      Alert.alert(
        "Order Unavailable",
        "We could not find the order you are trying to pay for.",
      );

      return;
    }

    //-------------------------------------
    // Validate Email
    //-------------------------------------

    if (!dbUser?.email) {
      Alert.alert(
        "Email Required",
        "An email address is required to process your payment.",
      );

      return;
    }

    //-------------------------------------
    // Validate Amount
    //-------------------------------------

    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert(
        "Invalid Amount",
        "The payment amount for this order is invalid.",
      );

      return;
    }

    //-------------------------------------
    // Already Paid
    //-------------------------------------
    //
    // If DataStore already knows that this
    // Order is paid, don't open Paystack
    // again.
    //
    //-------------------------------------

    if (order.paymentStatus === "PAID") {
      //---------------------------------
      // Show Existing Code If Available
      //---------------------------------

      if (order.deliveryVerificationCode) {
        Alert.alert(
          "Payment Already Confirmed",
          `This order has already been paid.\n\nDelivery Verification Code: ${order.deliveryVerificationCode}\n\nKeep this code safe. It will be required to complete your delivery.`,
          [
            {
              text: "Continue",

              onPress: () => completePaymentFlow(order.id),
            },
          ],
        );

        return;
      }

      //---------------------------------
      // Paid But Code Missing
      //---------------------------------

      Alert.alert(
        "Payment Already Confirmed",
        "This order has already been paid. You can continue to your order.",
        [
          {
            text: "Continue",

            onPress: () => completePaymentFlow(order.id),
          },
        ],
      );

      return;
    }

    //-------------------------------------
    // Start Loading
    //-------------------------------------

    setPaymentLoading(true);

    //-------------------------------------
    // Generate Paystack Reference
    //-------------------------------------
    //
    // A unique reference makes it easier
    // to trace each payment.
    //
    //-------------------------------------

    const reference = `ref_${Date.now()}`;

    console.log("STARTING PAYSTACK PAYMENT:", {
      orderId: order.id,

      amount,

      reference,
    });

    //-------------------------------------
    // Open Paystack Checkout
    //-------------------------------------

    try {
      popup.checkout({
        email: dbUser.email,

        amount,

        reference,

        currency: "NGN",

        channels: ["card"],

        //---------------------------------
        // Add Order ID To Paystack
        //---------------------------------

        metadata: {
          custom_fields: [
            {
              display_name: "Atua Order ID",

              variable_name: "order_id",

              value: order.id,
            },
          ],
        },

        //---------------------------------
        // Callbacks
        //---------------------------------

        onSuccess: handleSuccess,

        onCancel: handleCancel,

        onLoad: handlePaystackLoad,

        onError: handlePaystackError,
      });
    } catch (error) {
      console.log("START PAYSTACK ERROR:", error);

      setPaymentLoading(false);

      Alert.alert(
        "Unable to Start Payment",
        error?.message || "The payment page could not be opened.",
      );
    }
  };

  //================================================
  // BACK
  //================================================

  const handleBack = () => {
    if (paymentLoading) {
      return;
    }

    router.back();
  };

  //================================================
  // LOADING
  //================================================

  if (loadingOrder) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#111827" />

          <Text style={styles.loadingText}>Preparing secure payment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  //================================================
  // MISSING ORDER
  //================================================

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={46} color="#DC2626" />

          <Text style={styles.errorTitle}>Order unavailable</Text>

          <Text style={styles.errorText}>
            We could not load the order you are trying to pay for.
          </Text>

          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => router.back()}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  //================================================
  // RENDER
  //================================================

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* =====================================
          HEADER
      ===================================== */}

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleBack}
          disabled={paymentLoading}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Secure Payment</Text>

        <View style={styles.headerButton} />
      </View>

      {/* =====================================
          CONTENT
      ===================================== */}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* =================================
            AMOUNT
        ================================= */}

        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Total to Pay</Text>

          <Text style={styles.amount}>₦{formattedAmount}</Text>

          <View style={styles.orderReferenceContainer}>
            <Text style={styles.orderReferenceLabel}>Order</Text>

            <Text style={styles.orderReference} numberOfLines={1}>
              #{order.id}
            </Text>
          </View>
        </View>

        {/* =================================
            PAYMENT SUMMARY
        ================================= */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>

          {/* Delivery Fare */}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery fare</Text>

            <Text style={styles.summaryValue}>
              ₦{formatMoney(order.operationalFare)}
            </Text>
          </View>

          {/* Platform Fee */}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Platform fee</Text>

            <Text style={styles.summaryValue}>
              ₦{formatMoney(order.platformFee)}
            </Text>
          </View>

          {/* VAT */}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>VAT</Text>

            <Text style={styles.summaryValue}>
              ₦{formatMoney(order.vatAmount)}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Total */}

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>

            <Text style={styles.totalValue}>₦{formattedAmount}</Text>
          </View>
        </View>

        {/* =================================
            SECURITY
        ================================= */}

        <View style={styles.securityCard}>
          <View style={styles.securityIcon}>
            <Ionicons name="shield-checkmark" size={23} color="#15803D" />
          </View>

          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>Secure checkout</Text>

            <Text style={styles.securityText}>
              Your payment is securely processed by Paystack. Atua does not
              store your card details.
            </Text>
          </View>
        </View>

        {/* =================================
            POWERED BY
        ================================= */}

        <View style={styles.poweredBy}>
          <Ionicons name="lock-closed" size={13} color="#6B7280" />

          <Text style={styles.poweredByText}>
            Secure payment powered by Paystack
          </Text>
        </View>
      </ScrollView>

      {/* =====================================
          BOTTOM CTA
      ===================================== */}

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.payButton, paymentLoading && styles.payButtonDisabled]}
          onPress={handlePay}
          disabled={paymentLoading}
          activeOpacity={0.85}
        >
          {paymentLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={18} color="#FFFFFF" />

              <Text style={styles.payButtonText}>Pay ₦{formattedAmount}</Text>

              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.bottomDisclaimer}>
          By continuing, you authorize this payment for your Atua delivery.
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default Payment;
