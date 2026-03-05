import { Text, View } from "react-native";
import styles from "./styles";

const OfferHeader = ({ offersCount, notifiedDriversCount }) => {
  if (offersCount === 0) {
    return (
      <View style={styles.header}>
        <Text style={styles.title}>Waiting for driver offers...</Text>
        <Text style={styles.subtitle}>
          Notified {notifiedDriversCount} freight drivers
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <Text style={styles.title}>🎉 {offersCount} Offers Received</Text>
      <Text style={styles.subtitle}>Select the best offer below</Text>
    </View>
  );
};

export default OfferHeader;
