import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
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
    recipientName,
    recipientNumber,
    recipientNumber2,
    orderDetails,
    setRecipientName,
    setRecipientNumber,
    setRecipientNumber2,
    setOrderDetails,
  } = useOrderContext();

  const { dbuser } = useAuthContext();

  const [recipientNameError, setRecipientNameError] = useState("");
  const [recipientNumberError, setRecipientNumberError] = useState("");

  const validate = () => {
    let hasError = false;

    if (!recipientName.trim() || recipientName.length < 2) {
      setRecipientNameError("Recipient name must be at least 2 characters.");
      hasError = true;
    } else {
      setRecipientNameError("");
    }

    if (!recipientNumber || recipientNumber.length < 11) {
      setRecipientNumberError("Phone number must be at least 11 digits.");
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

  const isFormValid = recipientName.length >= 2 && recipientNumber.length >= 11;

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
            <Text style={styles.subtitle}>
              Enter recipient & package details
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
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
