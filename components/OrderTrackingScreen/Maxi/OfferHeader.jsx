import { Text, View } from "react-native";
import styles from "./styles";

const OfferHeader = ({ offersCount, notifiedDriversCount }) => {
  const offerText = offersCount === 1 ? "Offer" : "Offers";

  if (offersCount === 0) {
    return (
      <View style={styles.header}>
        <Text style={styles.title}>Waiting for driver offers...</Text>
        <Text style={styles.subtitle}>
          Notified {notifiedDriversCount} maxi drivers
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <Text style={styles.title}>
        {offersCount} {offerText} Received
      </Text>
      <Text style={styles.subtitle}>Select the best offer below</Text>
    </View>
  );
};

export default OfferHeader;
