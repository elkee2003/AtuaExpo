// components/maxi/MaxiBiddingSheet.js

import { router } from "expo-router";
import { FlatList, Text, View } from "react-native";
import OfferCard from "./OfferCard";
import OfferCountdown from "./OfferCountdown";
import OfferHeader from "./OfferHeader";
import styles from "./styles";

const MaxiBiddingSheet = ({
  offers,
  notifiedDriversCount,
  onAcceptOffer,
  onCounterOffer,
  onCancel,
  expiresAt,
}) => {
  return (
    <View style={styles.container}>
      <OfferHeader
        offersCount={offers.length}
        notifiedDriversCount={notifiedDriversCount}
      />

      {offers.length === 0 && <OfferCountdown expiresAt={expiresAt} />}

      <FlatList
        data={offers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OfferCard
            offer={item}
            onAccept={() => onAcceptOffer(item)}
            onCounter={() => onCounterOffer(item)}
          />
        )}
        contentContainerStyle={{ paddingBottom: 120 }}
      />

      <Text
        style={styles.orderText}
        onPress={() => {
          router.push("/orderhistory");
        }}
      >
        Order History
      </Text>

      <Text style={styles.cancelText} onPress={onCancel}>
        Cancel Order
      </Text>
    </View>
  );
};

export default MaxiBiddingSheet;
