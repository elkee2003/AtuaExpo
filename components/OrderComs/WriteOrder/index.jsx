import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthContext } from "../../../providers/AuthProvider";
import { useOrderContext } from "../../../providers/OrderProvider";
import styles from "./styles";

const WriteOrder = () => {
  const {
    senderName,
    senderNumber,
    senderNumber2,
    recipientName,
    recipientNumber,
    recipientNumber2,
    orderDetails,
    setSenderName,
    setSenderNumber,
    setSenderNumber2,
    setRecipientName,
    setRecipientNumber,
    setRecipientNumber2,
    setOrderDetails,
  } = useOrderContext();

  const { dbUser } = useAuthContext();

  const [recipientNameError, setRecipientNameError] = useState("");
  const [recipientNumberError, setRecipientNumberError] = useState("");
  const [senderNameError, setSenderNameError] = useState("");
  const [senderNumberError, setSenderNumberError] = useState("");

  // useEffect to autofill sender details

  useEffect(() => {
    if (!dbUser) return;

    const fullName = [dbUser.firstName, dbUser.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    // Populate sender details only when the fields are empty.
    if (!senderName?.trim() && fullName) {
      setSenderName(fullName);
    }

    if (!senderNumber?.trim() && dbUser.phoneNumber) {
      setSenderNumber(dbUser.phoneNumber);
    }
  }, [dbUser, senderName, senderNumber, setSenderName, setSenderNumber]);

  const validate = () => {
    let hasError = false;

    // Sender name
    if (!senderName?.trim() || senderName.trim().length < 2) {
      setSenderNameError("Sender name must be at least 2 characters.");
      hasError = true;
    } else {
      setSenderNameError("");
    }

    // Sender phone number
    if (!senderNumber?.trim() || senderNumber.trim().length < 11) {
      setSenderNumberError(
        "Sender phone number must be at least 11 characters.",
      );
      hasError = true;
    } else {
      setSenderNumberError("");
    }

    // Recipient name
    if (!recipientName?.trim() || recipientName.trim().length < 2) {
      setRecipientNameError("Recipient name must be at least 2 characters.");
      hasError = true;
    } else {
      setRecipientNameError("");
    }

    // Recipient phone number
    if (!recipientNumber?.trim() || recipientNumber.trim().length < 11) {
      setRecipientNumberError("Phone number must be at least 11 characters.");
      hasError = true;
    } else {
      setRecipientNumberError("");
    }

    return !hasError;
  };

  const goToReviewOrder = () => {
    if (validate()) {
      router.push("/screens/checkout");
    }
  };

  const isFormValid =
    senderName?.trim().length >= 2 &&
    senderNumber?.trim().length >= 11 &&
    recipientName?.trim().length >= 2 &&
    recipientNumber?.trim().length >= 11;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        // keyboardVerticalOffset={80}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContainer}
        >
          {/* Header */}
          <View style={styles.headerContainer}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={22} color="#111" />
            </TouchableOpacity>

            <Text style={styles.title}>New Delivery</Text>
            <Text style={styles.subtitle}>Enter Package Details</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Sender Name */}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Sender Name</Text>

              <TextInput
                style={[
                  styles.input,
                  senderNameError ? styles.inputError : null,
                ]}
                value={senderName}
                onChangeText={(value) => {
                  setSenderName(value);
                  if (senderNameError) setSenderNameError("");
                }}
                placeholder="Enter sender's name"
                placeholderTextColor="#9CA3AF"
              />

              {senderNameError ? (
                <Text style={styles.errorText}>{senderNameError}</Text>
              ) : null}
            </View>

            {/* Sender Primary Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Sender Phone Number</Text>
              <TextInput
                style={[
                  styles.input,
                  senderNumberError ? styles.inputError : null,
                ]}
                value={senderNumber}
                onChangeText={(value) => {
                  setSenderNumber(value);
                  if (senderNumberError) setSenderNumberError("");
                }}
                placeholder="e.g. 08012345678"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
              {senderNumberError ? (
                <Text style={styles.errorText}>{senderNumberError}</Text>
              ) : null}
            </View>

            {/* Sender Backup Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Sender Backup Number (Optional)</Text>
              <TextInput
                style={styles.input}
                value={senderNumber2}
                onChangeText={setSenderNumber2}
                placeholder="e.g. 07012345678"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
            </View>

            {/* Recipient Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Recipient Name</Text>
              <TextInput
                style={[
                  styles.input,
                  recipientNameError ? styles.inputError : null,
                ]}
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder="e.g. John Doe"
                placeholderTextColor="#9CA3AF"
              />
              {recipientNameError ? (
                <Text style={styles.errorText}>{recipientNameError}</Text>
              ) : null}
            </View>

            {/* Primary Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={[
                  styles.input,
                  recipientNumberError ? styles.inputError : null,
                ]}
                value={recipientNumber}
                onChangeText={setRecipientNumber}
                placeholder="e.g. 08012345678"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
              />
              {recipientNumberError ? (
                <Text style={styles.errorText}>{recipientNumberError}</Text>
              ) : null}
            </View>

            {/* Backup Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Backup Number (Optional)</Text>
              <TextInput
                style={styles.input}
                value={recipientNumber2}
                onChangeText={setRecipientNumber2}
                placeholder="e.g. 07012345678"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
              />
            </View>

            {/* Order Details */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Package Details</Text>
              <TextInput
                style={styles.textArea}
                value={orderDetails}
                onChangeText={setOrderDetails}
                placeholder="Describe the package briefly (Letter, Food, Clothes, Breakable items, etc.)"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={5}
              />
            </View>
          </View>

          {/* Button */}
          <TouchableOpacity
            style={[styles.button, !isFormValid && styles.buttonDisabled]}
            onPress={goToReviewOrder}
            disabled={!isFormValid}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Review Order</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default WriteOrder;
