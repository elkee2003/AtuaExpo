import { useAuthContext } from "@/providers/AuthProvider";
import { useLocationContext } from "@/providers/LocationProvider";
import { useOrderContext } from "@/providers/OrderProvider";

import {
  chargeAtuaPaymentMethod,
  verifyAtuaPayment,
} from "@/src/graphql/mutations";

import { Order } from "@/src/models";

import Ionicons from "@expo/vector-icons/Ionicons";
import { generateClient } from "aws-amplify/api";
import { DataStore } from "aws-amplify/datastore";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";

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

import SavedPaymentMethods from "./SavedPaymentMethods";
import styles from "./styles";

//==================================================
// AMPLIFY GRAPHQL CLIENT
//==================================================

const client = generateClient();

//==================================================
// INITIALIZE ATUA PAYMENT MUTATION
//==================================================
// This mutation registers the Payment and reference
// in Atua's backend BEFORE Paystack checkout opens.
//==================================================

const initializeAtuaPaymentMutation = `
  mutation InitializeAtuaPayment(
    $orderId: ID!
    $payerEmail: AWSEmail
    $payerPhone: String
  ) {
    initializeAtuaPayment(
      orderId: $orderId
      payerEmail: $payerEmail
      payerPhone: $payerPhone
    ) {
      success
      message
      orderId
      paymentId
      reference
      checkoutUrl
      amount
      currency
      payerEmail
      paymentResponsibility
    }
  }
`;

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
  // State
  //-----------------------------------------

  const [order, setOrder] = useState(null);

  const [loadingOrder, setLoadingOrder] = useState(true);

  const [paymentLoading, setPaymentLoading] = useState(false);

  //================================================
  // FETCH ORDER
  //================================================

  useEffect(() => {
    let mounted = true;

    const fetchOrder = async () => {
      try {
        setLoadingOrder(true);

        if (!orderId) {
          throw new Error("Order ID was not provided.");
        }

        const savedOrder = await DataStore.query(Order, orderId);

        if (!savedOrder) {
          throw new Error("Order could not be found.");
        }

        if (savedOrder.userID !== dbUser?.id) {
          throw new Error(
            "You are not authorized to make payment for this order.",
          );
        }

        if (mounted) {
          setOrder(savedOrder);
        }
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
        if (mounted) {
          setLoadingOrder(false);
        }
      }
    };

    if (dbUser?.id) {
      fetchOrder();
    }

    return () => {
      mounted = false;
    };
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

    resetAllOrderFields();
    resetAllLocationFields();

    router.replace(`/screens/orderTrackingScreen/${paidOrderId}`);
  };

  //================================================
  // CHECK WHETHER ORDER IS FULLY PAID
  //================================================
  // We require the webhook's expected Order fields:
  // - paymentStatus = PAID
  // - paymentID exists
  // - fundsStatus = HELD
  // - deliveryVerificationCode exists
  //================================================

  const isOrderPaymentComplete = (savedOrder) => {
    return (
      savedOrder?.id === orderId &&
      savedOrder?.paymentStatus === "PAID" &&
      !!savedOrder?.paymentID &&
      savedOrder?.fundsStatus === "HELD" &&
      !!savedOrder?.deliveryVerificationCode
    );
  };

  //================================================
  // WAIT FOR ORDER DATASTORE SYNC
  //================================================
  // This function waits for the Paystack webhook
  // to update the Order and for DataStore to receive
  // that update.
  //
  // It does NOT call verifyAtuaPayment.
  //================================================

  const waitForOrderSync = async (targetOrderId, timeout = 15000) => {
    return new Promise((resolve, reject) => {
      let finished = false;
      let subscription = null;
      let timeoutHandle = null;

      const finish = (callback, value) => {
        if (finished) {
          return;
        }

        finished = true;

        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        if (subscription) {
          subscription.unsubscribe();
        }

        callback(value);
      };

      // Subscribe first so an update is not missed
      // between the initial query and subscription.
      subscription = DataStore.observe(Order, targetOrderId).subscribe({
        next: ({ element, opType }) => {
          console.log("ORDER DATASTORE UPDATE:", {
            opType,
            id: element?.id,
            paymentStatus: element?.paymentStatus,
            paymentID: element?.paymentID,
            fundsStatus: element?.fundsStatus,
            deliveryVerificationCode: element?.deliveryVerificationCode,
          });

          if (isOrderPaymentComplete(element)) {
            finish(resolve, element);
          }
        },

        error: (error) => {
          console.error("ORDER DATASTORE OBSERVE ERROR:", error);
        },
      });

      timeoutHandle = setTimeout(() => {
        finish(reject, new Error("Order synchronization timed out."));
      }, timeout);

      // Also check the current local DataStore record.
      DataStore.query(Order, targetOrderId)
        .then((currentOrder) => {
          if (isOrderPaymentComplete(currentOrder)) {
            finish(resolve, currentOrder);
          }
        })
        .catch((error) => {
          console.log("INITIAL DATASTORE PAYMENT CHECK ERROR:", error);
        });
    });
  };

  //================================================
  // DISPLAY PAYMENT SUCCESS
  //================================================

  const showPaymentSuccess = (savedOrder, reference) => {
    const verificationCode = savedOrder?.deliveryVerificationCode;

    console.log("ATUA PAYMENT CONFIRMED:", {
      orderId: savedOrder?.id,
      paymentID: savedOrder?.paymentID,
      paymentReference: savedOrder?.paymentReference || reference,
      paymentStatus: savedOrder?.paymentStatus,
      fundsStatus: savedOrder?.fundsStatus,
      deliveryVerificationCode: verificationCode,
    });

    if (!verificationCode) {
      Alert.alert(
        "Payment Confirmed",
        "Your payment has been confirmed. Your delivery verification code is still being synchronized.",
        [
          {
            text: "Continue",
            onPress: () => completePaymentFlow(savedOrder.id),
          },
        ],
      );

      return;
    }

    Alert.alert(
      "Payment Successful",
      `Your payment has been confirmed successfully.\n\nDelivery Verification Code: ${verificationCode}\n\nKeep this code safe. It will be required to complete your delivery.`,
      [
        {
          text: "Continue",
          onPress: () => completePaymentFlow(savedOrder.id),
        },
      ],
    );
  };

  //================================================
  // VERIFY PAYMENT - FALLBACK ONLY
  //================================================
  // IMPORTANT:
  // paystackWebhook is the PRIMARY confirmation.
  //
  // This function is called only when the webhook
  // has not updated DataStore within the waiting
  // period after the customer returns from checkout.
  //================================================

  const verifyPaymentAsFallback = async (targetOrderId, reference) => {
    console.log("WEBHOOK WAIT EXPIRED.");
    console.log("RUNNING FALLBACK PAYMENT VERIFICATION:", {
      orderId: targetOrderId,
      reference,
    });

    const result = await client.graphql({
      query: verifyAtuaPayment,

      variables: {
        orderId: targetOrderId,
        reference,
      },
    });

    const verification = result?.data?.verifyAtuaPayment;

    console.log("FALLBACK VERIFICATION RESPONSE:", verification);

    if (!verification) {
      throw new Error(
        "The payment verification service returned an invalid response.",
      );
    }

    if (!verification.success || !verification.verified) {
      throw new Error(
        verification.message || "The payment could not be verified.",
      );
    }

    if (verification.orderId && verification.orderId !== targetOrderId) {
      throw new Error("The verified payment does not match this order.");
    }

    // The fallback has verified the transaction.
    // Give DataStore another opportunity to receive
    // the Order update made by the fallback Lambda.
    try {
      const syncedOrder = await waitForOrderSync(targetOrderId, 15000);

      return syncedOrder;
    } catch (syncError) {
      console.warn("ORDER SYNC AFTER FALLBACK VERIFICATION:", syncError);
    }

    // If the verifier confirms payment but DataStore
    // has not synchronized yet, do not ask the user
    // to pay again.
    const currentOrder = await DataStore.query(Order, targetOrderId);

    if (currentOrder?.paymentStatus === "PAID") {
      return currentOrder;
    }

    // The Lambda response itself confirms that
    // Paystack verified the transaction.
    return {
      id: targetOrderId,
      paymentStatus: "PAID",
      paymentReference: verification.payment?.reference || reference,
      deliveryVerificationCode: verification.deliveryVerificationCode || null,
      paymentID: null,
      fundsStatus: null,
      _fallbackVerified: true,
    };
  };

  //================================================
  // NEW CARD CHECKOUT
  //================================================
  // 1. Initialize payment on Atua backend.
  // 2. Backend registers Payment and reference.
  // 3. Open backend-generated Paystack checkout URL.
  // 4. Wait for paystackWebhook / DataStore.
  // 5. Call verifyAtuaPayment only as fallback.
  //================================================

  const handlePay = async () => {
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

    if (order.paymentStatus === "PAID") {
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
      } else {
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
      }

      return;
    }

    //-------------------------------------
    // Start Loading
    //-------------------------------------

    setPaymentLoading(true);

    let initializedReference = null;

    try {
      //-------------------------------------
      // STEP 1: INITIALIZE PAYMENT ON BACKEND
      //-------------------------------------
      // Do not generate a reference in the app.
      //
      // initializeAtuaPayment generates or reuses
      // the registered reference and creates/updates
      // the Payment record before Paystack checkout.
      //-------------------------------------

      console.log("INITIALIZING ATUA PAYMENT:", {
        orderId: order.id,
        payerEmail: dbUser.email,
      });

      const initializationResponse = await client.graphql({
        query: initializeAtuaPaymentMutation,

        // The schema requires an authenticated
        // Cognito User Pool session for this mutation.
        authMode: "userPool",

        variables: {
          orderId: order.id,
          payerEmail: dbUser.email.trim().toLowerCase(),
          payerPhone: dbUser.phoneNumber || null,
        },
      });

      const initialization =
        initializationResponse?.data?.initializeAtuaPayment;

      console.log("INITIALIZE ATUA PAYMENT RESPONSE:", initialization);

      //-------------------------------------
      // Validate Initialization Response
      //-------------------------------------

      if (!initialization) {
        throw new Error(
          "The payment initialization service returned an invalid response.",
        );
      }

      if (!initialization.success) {
        throw new Error(
          initialization.message || "Atua could not initialize this payment.",
        );
      }

      if (initialization.orderId !== order.id) {
        throw new Error("The initialized payment does not match this order.");
      }

      if (!initialization.reference) {
        throw new Error(
          "The payment service did not return a transaction reference.",
        );
      }

      if (!initialization.checkoutUrl) {
        throw new Error(
          "The payment service did not return a Paystack checkout URL.",
        );
      }

      if (
        typeof initialization.checkoutUrl !== "string" ||
        !initialization.checkoutUrl.startsWith("https://")
      ) {
        throw new Error("The returned Paystack checkout URL is invalid.");
      }

      initializedReference = initialization.reference;

      //-------------------------------------
      // Validate Amount Returned By Backend
      //-------------------------------------
      // The backend amount is the authoritative
      // amount to be charged by Paystack.
      //-------------------------------------

      const backendAmount = Number(initialization.amount);

      if (!Number.isFinite(backendAmount) || backendAmount <= 0) {
        throw new Error("The backend returned an invalid payment amount.");
      }

      if (Math.round(backendAmount * 100) !== Math.round(amount * 100)) {
        throw new Error(
          "The payment amount returned by the server does not match the order total. Please contact support before proceeding.",
        );
      }

      console.log("ATUA PAYMENT INITIALIZED:", {
        orderId: order.id,
        paymentId: initialization.paymentId,
        reference: initializedReference,
        amount: backendAmount,
        currency: initialization.currency,
        paymentResponsibility: initialization.paymentResponsibility,
      });

      //-------------------------------------
      // STEP 2: OPEN PAYSTACK CHECKOUT
      //-------------------------------------
      // Paystack receives the checkout URL generated
      // by the Lambda. We do not initialize Paystack
      // directly from the frontend.
      //-------------------------------------

      console.log("OPENING REGISTERED PAYSTACK CHECKOUT:", {
        orderId: order.id,
        reference: initializedReference,
      });

      const browserResult = await WebBrowser.openBrowserAsync(
        initialization.checkoutUrl,
      );

      console.log("PAYSTACK BROWSER RESULT:", browserResult);

      //-------------------------------------
      // STEP 3: WAIT FOR WEBHOOK FIRST
      //-------------------------------------
      // Closing the browser does not prove that
      // payment failed or succeeded.
      //
      // Give paystackWebhook time to process the
      // transaction and DataStore time to sync.
      //-------------------------------------

      console.log("WAITING FOR PAYSTACK WEBHOOK / DATASTORE UPDATE...");

      let syncedOrder = null;

      try {
        syncedOrder = await waitForOrderSync(order.id, 15000);

        console.log("PAYMENT CONFIRMED BY WEBHOOK / DATASTORE:", {
          orderId: syncedOrder.id,
          paymentID: syncedOrder.paymentID,
          paymentStatus: syncedOrder.paymentStatus,
          fundsStatus: syncedOrder.fundsStatus,
          deliveryVerificationCode: syncedOrder.deliveryVerificationCode,
        });

        showPaymentSuccess(syncedOrder, initializedReference);

        return;
      } catch (webhookWaitError) {
        console.log(
          "WEBHOOK CONFIRMATION NOT YET AVAILABLE:",
          webhookWaitError?.message,
        );
      }

      //-------------------------------------
      // STEP 4: CHECK DATASTORE ONE MORE TIME
      //-------------------------------------
      // Avoid invoking the fallback if the webhook
      // updated the order at the end of the wait.
      //-------------------------------------

      const latestOrder = await DataStore.query(Order, order.id);

      if (isOrderPaymentComplete(latestOrder)) {
        showPaymentSuccess(latestOrder, initializedReference);

        return;
      }

      //-------------------------------------
      // STEP 5: FALLBACK VERIFICATION
      //-------------------------------------
      // Only now do we invoke verifyAtuaPayment.
      //
      // The exact reference returned by
      // initializeAtuaPayment is passed through.
      //-------------------------------------

      const fallbackOrder = await verifyPaymentAsFallback(
        order.id,
        initializedReference,
      );

      //-------------------------------------
      // STEP 6: SHOW RESULT
      //-------------------------------------

      if (fallbackOrder?._fallbackVerified) {
        const verificationCode = fallbackOrder.deliveryVerificationCode;

        console.log("PAYMENT CONFIRMED BY FALLBACK VERIFICATION:", {
          orderId: fallbackOrder.id,
          reference: initializedReference,
          verificationCode,
        });

        Alert.alert(
          "Payment Confirmed",
          verificationCode
            ? `Your payment has been verified successfully.\n\nDelivery Verification Code: ${verificationCode}\n\nKeep this code safe. It will be required to complete your delivery.`
            : "Your payment has been verified successfully. Your order is still synchronizing.",
          [
            {
              text: "Continue",
              onPress: () => completePaymentFlow(order.id),
            },
          ],
        );

        return;
      }

      showPaymentSuccess(fallbackOrder, initializedReference);
    } catch (error) {
      console.error("ATUA PAYMENT ERROR:", {
        orderId: order?.id,
        reference: initializedReference,
        message: error?.message,
        errors: error?.errors,
      });

      const graphQLError = error?.errors?.[0]?.message;

      const message =
        graphQLError || error?.message || "We could not confirm your payment.";

      //-------------------------------------
      // IMPORTANT
      //-------------------------------------
      // Do not tell the customer to pay again.
      //
      // The customer may have completed payment
      // even if the browser closed or the webhook
      // has not yet updated the Order.
      //-------------------------------------

      Alert.alert(
        "Payment Processing",
        `${message}\n\nIf you completed the Paystack payment, do not make another payment yet. Your transaction may still be processing. Please check your order or contact support if the status does not update.`,
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  //================================================
  // SAVED PAYMENT METHOD
  //================================================
  // This flow is intentionally kept separate.
  // It continues to use chargeAtuaPaymentMethod
  // and waits for the webhook to update the Order.
  //================================================

  const handlePayWithSavedCard = async (paymentMethod) => {
    if (paymentLoading) {
      return;
    }

    if (!order?.id) {
      Alert.alert(
        "Order Unavailable",
        "We could not find the order you are trying to pay for.",
      );

      return;
    }

    if (!paymentMethod?.id) {
      Alert.alert(
        "Payment Method Unavailable",
        "Please select a saved card and try again.",
      );

      return;
    }

    if (order.paymentStatus === "PAID") {
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
      } else {
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
      }

      return;
    }

    setPaymentLoading(true);

    try {
      console.log("CHARGING SAVED PAYMENT METHOD:", {
        orderId: order.id,
        paymentMethodId: paymentMethod.id,
      });

      const result = await client.graphql({
        query: chargeAtuaPaymentMethod,

        authMode: "userPool",

        variables: {
          orderId: order.id,
          paymentMethodId: paymentMethod.id,
        },
      });

      console.log("SAVED PAYMENT METHOD RESPONSE:", result);

      const chargeResult = result?.data?.chargeAtuaPaymentMethod;

      if (!chargeResult) {
        throw new Error(
          "The saved-card payment service returned an invalid response.",
        );
      }

      if (!chargeResult.success) {
        throw new Error(
          chargeResult.message || "The saved card could not be charged.",
        );
      }

      console.log("SAVED CARD CHARGE ACCEPTED:", {
        orderId: order.id,
        paymentMethodId: paymentMethod.id,
        reference: chargeResult.reference || null,
      });

      //-------------------------------------
      // Wait for paystackWebhook
      //-------------------------------------

      let syncedOrder;

      try {
        syncedOrder = await waitForOrderSync(order.id, 30000);
      } catch (syncError) {
        console.error("SAVED CARD ORDER DATASTORE SYNC FAILED:", syncError);

        Alert.alert(
          "Payment Processing",
          "Your saved card payment was submitted successfully, but we're still confirming your order. Please do not make another payment yet.",
          [
            {
              text: "OK",
            },
          ],
        );

        return;
      }

      //-------------------------------------
      // Final Confirmation
      //-------------------------------------

      const verificationCode = syncedOrder.deliveryVerificationCode;

      if (!verificationCode) {
        Alert.alert(
          "Payment Confirmed",
          "Your payment was confirmed, but your delivery verification code is still being synchronized. Please continue to your order.",
          [
            {
              text: "Continue",
              onPress: () => completePaymentFlow(order.id),
            },
          ],
        );

        return;
      }

      Alert.alert(
        "Payment Successful",
        `Your payment has been confirmed successfully.\n\nDelivery Verification Code: ${verificationCode}\n\nKeep this code safe. It will be required to complete your delivery.`,
        [
          {
            text: "Continue",
            onPress: () => completePaymentFlow(order.id),
          },
        ],
      );
    } catch (error) {
      console.log("SAVED PAYMENT METHOD ERROR:", error);

      const graphQLError = error?.errors?.[0]?.message;

      const message =
        graphQLError ||
        error?.message ||
        "We could not process the saved card payment.";

      Alert.alert(
        "Saved Card Payment",
        `${message}\n\nIf you were charged, do not make another payment yet.`,
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  //================================================
  // USE NEW CARD
  //================================================

  const handleUseNewCard = () => {
    if (paymentLoading) {
      return;
    }

    handlePay();
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
      {/* HEADER */}

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

      {/* CONTENT */}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* AMOUNT */}

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

        {/* PAYMENT SUMMARY */}

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

        {/* SAVED PAYMENT METHODS */}

        <SavedPaymentMethods
          onPayWithSavedCard={handlePayWithSavedCard}
          onUseNewCard={handleUseNewCard}
          paymentLoading={paymentLoading}
        />

        {/* SECURITY */}

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

        {/* POWERED BY */}

        <View style={styles.poweredBy}>
          <Ionicons name="lock-closed" size={13} color="#6B7280" />

          <Text style={styles.poweredByText}>
            Secure payment powered by Paystack
          </Text>
        </View>
      </ScrollView>

      {/* BOTTOM CTA */}

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
