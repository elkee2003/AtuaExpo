import { useAuthContext } from "@/providers/AuthProvider";
import { useOrderContext } from "@/providers/OrderProvider";
import { useEffect } from "react";

import { router } from "expo-router";
import { ScrollView, Text, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import styles from "./styles";

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
    orders,
    setOrders,
    orderError,
    setOrderError,
  } = useOrderContext();

  const { dbUser } = useAuthContext();

  // useEffect to autofill Sender details

  useEffect(() => {
    if (!dbUser) return;

    const fullName = [dbUser.firstName, dbUser.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!senderName?.trim() && fullName) {
      setSenderName(fullName);
    }

    if (!senderNumber?.trim() && dbUser.phoneNumber) {
      setSenderNumber(dbUser.phoneNumber);
    }
  }, [dbUser, senderName, senderNumber, setSenderName, setSenderNumber]);

  const validateRecipientDetails = () => {
    setOrderError("");

    if (!senderName || senderName.trim().length < 2) {
      setOrderError("Sender name is required");
      return false;
    }

    if (!senderNumber || senderNumber.replace(/\D/g, "").length < 11) {
      setOrderError("Sender phone must be at least 11 digits");
      return false;
    }

    if (!recipientName || recipientName.trim().length < 2) {
      setOrderError("Recipient name is required");
      return false;
    }

    if (!recipientNumber || recipientNumber.replace(/\D/g, "").length < 11) {
      setOrderError("Recipient phone must be at least 11 digits");
      return false;
    }

    return true;
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView>
        <Text style={styles.title}>Sender & Recipient Details</Text>

        {/* Sender Name */}
        <TextInput
          placeholder="Sender Name *"
          placeholderTextColor="#8B93A1"
          style={styles.input}
          value={senderName}
          onChangeText={setSenderName}
        />

        {/* Sender Phone Number */}
        <TextInput
          placeholder="Sender Phone Number *"
          placeholderTextColor="#8B93A1"
          keyboardType="phone-pad"
          style={styles.input}
          value={senderNumber}
          onChangeText={setSenderNumber}
        />

        {/* Sender Backup Phone Number */}
        <TextInput
          placeholder="Sender Backup Phone Number"
          placeholderTextColor="#8B93A1"
          keyboardType="phone-pad"
          style={styles.input}
          value={senderNumber2}
          onChangeText={setSenderNumber2}
        />

        {/* Recipient Name */}
        <TextInput
          placeholder="Recipient Name *"
          placeholderTextColor="#8B93A1"
          style={styles.input}
          value={recipientName}
          onChangeText={setRecipientName}
        />

        {/* Recipient Phone Number */}
        <TextInput
          placeholder="Recipient Phone Number *"
          placeholderTextColor="#8B93A1"
          keyboardType="phone-pad"
          style={styles.input}
          value={recipientNumber}
          onChangeText={setRecipientNumber}
        />

        {/* Backup Phone Number */}
        <TextInput
          placeholder="Backup Phone Number"
          placeholderTextColor="#8B93A1"
          keyboardType="phone-pad"
          style={styles.input}
          value={recipientNumber2}
          onChangeText={setRecipientNumber2}
        />
      </ScrollView>

      {/* Error */}
      {orderError ? <Text style={styles.error}>{orderError}</Text> : null}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => {
          if (!validateRecipientDetails()) return;

          router.push("/screens/checkout/maxisubmit");
        }}
      >
        <Text style={styles.buttonText}>Review Order</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
