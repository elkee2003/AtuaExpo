import { Text, View } from "react-native";
import styles from "./styles";

const OfferHeader = ({ offersCount }) => {
  const isEmpty = offersCount === 0;

  const offerText = offersCount === 1 ? "Offer" : "Offers";

  return (
    <View style={styles.header}>
      {/* STATUS PILL */}
      <View
        style={[
          styles.statusPill,
          isEmpty ? styles.statusPillWaiting : styles.statusPillActive,
        ]}
      >
        <View
          style={[
            styles.statusDot,
            isEmpty ? styles.dotWaiting : styles.dotActive,
          ]}
        />
        <Text style={styles.statusText}>
          {isEmpty ? "Waiting for couriers" : "Live offers"}
        </Text>
      </View>

      {/* MAIN TITLE */}
      <Text style={styles.title}>
        {isEmpty
          ? "Finding nearby couriers..."
          : `${offersCount} ${offerText} Received`}
      </Text>

      {/* SUBTITLE */}
      <Text style={styles.subtitle}>
        {isEmpty
          ? "We've notified available couriers in your area"
          : "Compare and select the best offer"}
      </Text>
    </View>
  );
};

export default OfferHeader;
