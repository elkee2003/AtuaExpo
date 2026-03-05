import { useOrderContext } from "@/providers/OrderProvider";
import { router } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import styles from "./styles";

const LOAD_CATEGORIES = [
  "GENERAL_GOODS",
  "FRAGILE",
  "BUILDING_MATERIAL",
  "HEAVY_MACHINERY",
  "PERISHABLE",
];

const WEIGHT_BRACKETS = [
  "UNDER_500KG",
  "500KG_2T",
  "2T_5T",
  "5T_10T",
  "10T_PLUS",
];

export default function MaxiCargoDetailsScreen() {
  const {
    loadCategory,
    setLoadCategory,
    orderDetails,
    setOrderDetails,
    declaredWeightBracket,
    setDeclaredWeightBracket,
    orderError,
    setOrderError,
  } = useOrderContext();

  const validateCargoDetails = () => {
    setOrderError("");

    if (!loadCategory) {
      setOrderError("Please select a load category");
      return false;
    }

    // if (!declaredWeightBracket) {
    //   setOrderError("Please select estimated weight");
    //   return false;
    // }

    if (!orderDetails || orderDetails.trim().length < 5) {
      setOrderError("Please enter cargo description");
      return false;
    }

    return true;
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={80} // tweak if needed
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Cargo Details</Text>

          <Text style={styles.sectionTitle}>Load Category *</Text>
          {LOAD_CATEGORIES.map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.optionCard,
                loadCategory === item && styles.selectedCard,
              ]}
              onPress={() => setLoadCategory(item)}
            >
              <Text style={styles.optionText}>{item.replaceAll("_", " ")}</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.sectionTitle}>Estimated Weight</Text>
          {WEIGHT_BRACKETS.map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.optionCard,
                declaredWeightBracket === item && styles.selectedCard,
              ]}
              onPress={() => setDeclaredWeightBracket(item)}
            >
              <Text style={styles.optionText}>{item.replaceAll("_", " ")}</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.sectionTitle}>Description *</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Describe your cargo..."
            multiline
            value={orderDetails}
            onChangeText={setOrderDetails}
          />
        </ScrollView>

        {/* Error */}
        {orderError ? <Text style={styles.error}>{orderError}</Text> : null}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            if (!validateCargoDetails()) return;

            router.push("/screens/searchresults/maxiloadingdetails");
          }}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
