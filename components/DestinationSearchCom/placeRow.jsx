import Entypo from "@expo/vector-icons/Entypo";
import React from "react";
import { Text, View } from "react-native";
import styles from "./styles";

const PlaceRow = ({ data }) => {
  const description = data.description || data.vicinity;

  return (
    <View style={styles.row}>
      <View style={styles.iconContainer}>
        <Entypo name="location-pin" size={18} color="#fff" />
      </View>

      <View style={styles.textContainer}>
        <Text numberOfLines={1} style={styles.locationTitle}>
          {description}
        </Text>

        <Text style={styles.locationSubtitle}>Tap to select location</Text>
      </View>
    </View>
  );
};

export default PlaceRow;
