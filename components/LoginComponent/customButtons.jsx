import { ActivityIndicator, Text, TouchableOpacity } from "react-native";
import styles from "./styles";

const CustomButton = ({ text, onPress, loading }) => {
  return (
    <TouchableOpacity
      style={styles.primaryButton}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.primaryButtonText}>{text}</Text>
      )}
    </TouchableOpacity>
  );
};

export default CustomButton;
