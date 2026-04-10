import { Image, Text, TouchableOpacity, View } from "react-native";
import styles from "./styles";

const OfferCard = ({
  offer,
  courier,
  order,
  onAccept,
  onCounter,
  isLatest,
  isAcceptDisabled,
}) => {
  const isUserTurn = isLatest && order?.lastOfferBy === "COURIER";

  return (
    <View
      style={[
        styles.card,
        isLatest && {
          borderColor: "#4CAF50",
          borderWidth: 2,
          backgroundColor: "#E8F5E9",
        },
      ]}
    >
      <Image source={{ uri: courier?.profilePic }} style={styles.avatar} />

      <View style={{ flex: 1 }}>
        <Text style={styles.name}>
          {courier?.firstName} {courier?.lastName}
        </Text>

        <Text style={styles.vehicle}>
          {courier?.vehicleClass} • {courier?.model}
        </Text>

        <Text style={styles.price}>₦{offer.amount}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.acceptBtn,
            (!isUserTurn || isAcceptDisabled) && { opacity: 0.5 },
          ]}
          onPress={onAccept}
          disabled={!isUserTurn || isAcceptDisabled}
        >
          <Text style={styles.acceptText}>Accept</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.counterBtn, !isUserTurn && { opacity: 0.5 }]}
          onPress={onCounter}
          disabled={!isUserTurn}
        >
          <Text style={styles.counterText}>Counter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default OfferCard;
