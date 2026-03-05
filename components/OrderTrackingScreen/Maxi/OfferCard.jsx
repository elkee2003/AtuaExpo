import { Image, Text, TouchableOpacity, View } from "react-native";
import styles from "./styles";

const OfferCard = ({ offer, onAccept, onCounter }) => {
  return (
    <View style={styles.card}>
      <Image source={{ uri: offer.courier.profilePic }} style={styles.avatar} />

      <View style={{ flex: 1 }}>
        <Text style={styles.name}>
          {offer.courier.firstName} {offer.courier.lastName}
        </Text>

        <Text style={styles.vehicle}>
          {offer.courier.vehicleClass} • {offer.courier.model}
        </Text>

        <Text style={styles.price}>₦{offer.amount}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
          <Text style={styles.acceptText}>Accept</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.counterBtn} onPress={onCounter}>
          <Text style={styles.counterText}>Counter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default OfferCard;
