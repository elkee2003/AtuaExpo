import { useOrderContext } from "@/providers/OrderProvider";
import { router } from "expo-router";
import { ScrollView, Text, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import styles from "./styles";

export default function MaxiRecipientScreen() {
  const {
    recipientName,
    recipientNumber,
    recipientNumber2,
    setRecipientName,
    setRecipientNumber,
    setRecipientNumber2,
    orders,
    setOrders,
    orderError,
    setOrderError,
  } = useOrderContext();

  const validateRecipientDetails = () => {
    setOrderError("");

    if (!recipientName || recipientName.trim().length < 2) {
      setOrderError("Recipient name is required");
      return false;
    }

    if (!recipientNumber || recipientNumber.length < 11) {
      setOrderError("Recipient phone must be at least 11 digits");
      return false;
    }

    return true;
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView>
        <Text style={styles.title}>Recipient Details</Text>

        <TextInput
          placeholder="Recipient Name *"
          style={styles.input}
          value={recipientName}
          onChangeText={setRecipientName}
        />

        <TextInput
          placeholder="Recipient Phone Number *"
          keyboardType="phone-pad"
          style={styles.input}
          value={recipientNumber}
          onChangeText={setRecipientNumber}
        />

        <TextInput
          placeholder="Backup Phone Number"
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
