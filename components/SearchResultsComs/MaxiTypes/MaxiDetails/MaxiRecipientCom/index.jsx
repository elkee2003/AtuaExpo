import { useAuthContext } from "@/providers/AuthProvider";
import { useOrderContext } from "@/providers/OrderProvider";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import styles from "./styles";

const PAYER_OPTIONS = [
  {
    value: "SENDER",
    title: "Myself (Sender)",
    description: "I'll pay for this delivery.",
    icon: "👤",
  },
  {
    value: "RECEIVER",
    title: "Receiver",
    description: "The recipient will pay for this delivery.",
    icon: "📦",
  },
];

export default function MaxiRecipientScreen() {
  const {
    senderName,
    senderNumber,
    senderNumber2,
    recipientName,
    recipientNumber,
    recipientNumber2,
    setSenderName,
    setSenderNumber,
    setSenderNumber2,
    setRecipientName,
    setRecipientNumber,
    setRecipientNumber2,
    paymentResponsibility,
    setPaymentResponsibility,
    paymentTiming,
    setPaymentTiming,
    paymentMethod,
    setPaymentMethod,
    orderError,
    setOrderError,
  } = useOrderContext();

  const { dbUser } = useAuthContext();

  // Tracks whether sender autofill has already been attempted.
  // This prevents cleared fields from being filled again.
  const hasAutofilledSender = useRef(false);

  // Autofill sender details from the authenticated user's profile.
  // This follows the same approach used in WriteOrder.jsx.
  useEffect(() => {
    if (!dbUser || hasAutofilledSender.current) return;

    const fullName = [dbUser.firstName, dbUser.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    const phone = dbUser.phoneNumber?.trim() || "";

    // Wait until at least one sender detail is available.
    if (!fullName && !phone) return;

    // Mark autofill as completed so clearing fields won't refill them.
    hasAutofilledSender.current = true;

    // Only fill fields that are currently empty.
    if (!senderName?.trim() && fullName) {
      setSenderName(fullName);
    }

    if (!senderNumber?.trim() && phone) {
      setSenderNumber(phone);
    }
  }, [dbUser, senderName, senderNumber, setSenderName, setSenderNumber]);

  // Select who is responsible for the delivery fee.
  const selectPaymentResponsibility = (responsibility) => {
    setPaymentResponsibility(responsibility);

    if (responsibility === "SENDER") {
      // Default to Paystack before pickup.
      setPaymentTiming("BEFORE_PICKUP");
      setPaymentMethod("PAYSTACK");
    } else if (responsibility === "RECEIVER") {
      // The receiver chooses their payment method at delivery.
      setPaymentTiming("ON_DELIVERY");
      setPaymentMethod(null);
    }

    setOrderError("");
  };

  // Select how the sender will pay.
  const selectPaymentArrangement = (timing, method) => {
    setPaymentResponsibility("SENDER");
    setPaymentTiming(timing);
    setPaymentMethod(method);
    setOrderError("");
  };

  const validateRecipientDetails = () => {
    setOrderError("");

    if (!senderName?.trim() || senderName.trim().length < 2) {
      setOrderError("Sender name is required.");
      return false;
    }

    if (!senderNumber || senderNumber.replace(/\D/g, "").length < 11) {
      setOrderError("Sender phone must be at least 11 digits.");
      return false;
    }

    if (!recipientName?.trim() || recipientName.trim().length < 2) {
      setOrderError("Recipient name is required.");
      return false;
    }

    if (!recipientNumber || recipientNumber.replace(/\D/g, "").length < 11) {
      setOrderError("Recipient phone must be at least 11 digits.");
      return false;
    }

    if (!["SENDER", "RECEIVER"].includes(paymentResponsibility)) {
      setOrderError("Please select who will pay for the delivery.");
      return false;
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
      setOrderError(
        "Your payment selection is inconsistent. Please select your payment arrangement again.",
      );
      return false;
    }

    return true;
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>Sender & Recipient Details</Text>

        {/* Sender Details */}
        <Text style={styles.sectionTitle}>Sender Details</Text>

        <TextInput
          placeholder="Sender Name *"
          placeholderTextColor="#8B93A1"
          style={styles.input}
          value={senderName || ""}
          onChangeText={(value) => {
            setSenderName(value);
            setOrderError("");
          }}
          autoCapitalize="words"
          accessibilityLabel="Sender name"
        />

        <TextInput
          placeholder="Sender Phone Number *"
          placeholderTextColor="#8B93A1"
          keyboardType="phone-pad"
          style={styles.input}
          value={senderNumber || ""}
          onChangeText={(value) => {
            setSenderNumber(value);
            setOrderError("");
          }}
          accessibilityLabel="Sender phone number"
        />

        <TextInput
          placeholder="Sender Backup Phone Number"
          placeholderTextColor="#8B93A1"
          keyboardType="phone-pad"
          style={styles.input}
          value={senderNumber2 || ""}
          onChangeText={(value) => {
            setSenderNumber2(value);
            setOrderError("");
          }}
          accessibilityLabel="Sender backup phone number"
        />

        {/* Recipient Details */}
        <Text style={styles.sectionTitle}>Recipient Details</Text>

        <TextInput
          placeholder="Recipient Name *"
          placeholderTextColor="#8B93A1"
          style={styles.input}
          value={recipientName || ""}
          onChangeText={(value) => {
            setRecipientName(value);
            setOrderError("");
          }}
          autoCapitalize="words"
          accessibilityLabel="Recipient name"
        />

        <TextInput
          placeholder="Recipient Phone Number *"
          placeholderTextColor="#8B93A1"
          keyboardType="phone-pad"
          style={styles.input}
          value={recipientNumber || ""}
          onChangeText={(value) => {
            setRecipientNumber(value);
            setOrderError("");
          }}
          accessibilityLabel="Recipient phone number"
        />

        <TextInput
          placeholder="Recipient Backup Phone Number"
          placeholderTextColor="#8B93A1"
          keyboardType="phone-pad"
          style={styles.input}
          value={recipientNumber2 || ""}
          onChangeText={(value) => {
            setRecipientNumber2(value);
            setOrderError("");
          }}
          accessibilityLabel="Recipient backup phone number"
        />

        {/* Who Pays */}
        <View style={styles.payerSection}>
          <Text style={styles.sectionTitle}>
            Who will pay for this delivery?
          </Text>

          <Text style={styles.payerSubtitle}>
            Choose who is responsible for the delivery fee.
          </Text>

          {PAYER_OPTIONS.map((option) => {
            const selected = paymentResponsibility === option.value;

            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.payerOption,
                  selected && styles.payerOptionSelected,
                ]}
                onPress={() => selectPaymentResponsibility(option.value)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={styles.payerIconContainer}>
                  <Text style={styles.payerIcon}>{option.icon}</Text>
                </View>

                <View style={styles.payerOptionText}>
                  <Text style={styles.payerOptionTitle}>{option.title}</Text>

                  <Text style={styles.payerOptionDescription}>
                    {option.description}
                  </Text>
                </View>

                <View
                  style={[
                    styles.radioOuter,
                    selected && styles.radioOuterSelected,
                  ]}
                >
                  {selected && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Sender Payment Method Options */}
          {paymentResponsibility === "SENDER" && (
            <View style={styles.paymentMethodsContainer}>
              <Text style={styles.sectionTitle}>
                How would you like to pay?
              </Text>

              <Text style={styles.payerSubtitle}>
                Choose your preferred payment method.
              </Text>

              {/* Paystack Before Pickup */}
              <TouchableOpacity
                style={[
                  styles.payerOption,
                  paymentTiming === "BEFORE_PICKUP" &&
                    paymentMethod === "PAYSTACK" &&
                    styles.payerOptionSelected,
                ]}
                onPress={() =>
                  selectPaymentArrangement("BEFORE_PICKUP", "PAYSTACK")
                }
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{
                  selected:
                    paymentTiming === "BEFORE_PICKUP" &&
                    paymentMethod === "PAYSTACK",
                }}
              >
                <View style={styles.payerIconContainer}>
                  <Text style={styles.payerIcon}>💳</Text>
                </View>

                <View style={styles.payerOptionText}>
                  <Text style={styles.payerOptionTitle}>
                    Pay Online (Paystack)
                  </Text>

                  <Text style={styles.payerOptionDescription}>
                    Pay securely before the courier picks up your item.
                  </Text>
                </View>

                <View
                  style={[
                    styles.radioOuter,
                    paymentTiming === "BEFORE_PICKUP" &&
                      paymentMethod === "PAYSTACK" &&
                      styles.radioOuterSelected,
                  ]}
                >
                  {paymentTiming === "BEFORE_PICKUP" &&
                    paymentMethod === "PAYSTACK" && (
                      <View style={styles.radioInner} />
                    )}
                </View>
              </TouchableOpacity>

              {/* Cash at Pickup */}
              <TouchableOpacity
                style={[
                  styles.payerOption,
                  paymentTiming === "AT_PICKUP" &&
                    paymentMethod === "CASH" &&
                    styles.payerOptionSelected,
                ]}
                onPress={() => selectPaymentArrangement("AT_PICKUP", "CASH")}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{
                  selected:
                    paymentTiming === "AT_PICKUP" && paymentMethod === "CASH",
                }}
              >
                <View style={styles.payerIconContainer}>
                  <Text style={styles.payerIcon}>💵</Text>
                </View>

                <View style={styles.payerOptionText}>
                  <Text style={styles.payerOptionTitle}>Cash at Pickup</Text>

                  <Text style={styles.payerOptionDescription}>
                    Pay the courier in cash when your item is picked up.
                  </Text>
                </View>

                <View
                  style={[
                    styles.radioOuter,
                    paymentTiming === "AT_PICKUP" &&
                      paymentMethod === "CASH" &&
                      styles.radioOuterSelected,
                  ]}
                >
                  {paymentTiming === "AT_PICKUP" &&
                    paymentMethod === "CASH" && (
                      <View style={styles.radioInner} />
                    )}
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Receiver Payment Information */}
          {paymentResponsibility === "RECEIVER" && (
            <View style={styles.receiverPaymentNotice}>
              <Text style={styles.receiverPaymentNoticeTitle}>
                Receiver Pays on Delivery
              </Text>

              <Text style={styles.receiverPaymentNoticeText}>
                The receiver will pay the delivery fee when the item arrives.
                The receiver can choose to pay with cash or electronic payment
                at delivery.
              </Text>

              <Text style={styles.receiverPaymentNoticeText}>
                Electronic payments must be verified before they are treated as
                paid.
              </Text>

              <Text style={styles.receiverPaymentWarning}>
                Important: If the receiver refuses or fails to pay, you as the
                sender remain responsible for the outstanding delivery fee.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {orderError ? <Text style={styles.error}>{orderError}</Text> : null}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => {
          if (!validateRecipientDetails()) return;

          router.push("/screens/checkout/maxisubmit");
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Review Order</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
