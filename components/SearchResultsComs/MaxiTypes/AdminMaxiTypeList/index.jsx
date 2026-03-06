// I'll use this page for admin to see the different vehicles people upload, then delete this component and screen after
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import styles from "./styles";

// Later:
// import { DataStore } from "aws-amplify";
// import { Courier } from "../../../src/models";

const dummyFreightData = [
  {
    id: "1",
    firstName: "Ibrahim",
    transportationType: "MAXI",
    vehicleClass: "FLATBED_10T",
    model: "10 Ton Flatbed",
    plateNumber: "YEN3943",
    maxiDescription:
      "Heavy machinery, containers, oversized cargo. Suitable for interstate industrial logistics and construction transport.",
    isApproved: true,
    isOnline: true,
    maxiImages: [
      require("../../../../assets/dummyMaxiImages/flatbed.jpg"),
      require("../../../../assets/dummyMaxiImages/flatbed1.jpg"),
      require("../../../../assets/dummyMaxiImages/flatbed2.jpg"),
    ],
  },
  {
    id: "2",
    firstName: "Chinedu",
    transportationType: "MAXI",
    vehicleClass: "TIPPER_20T",
    model: "20 Ton Tipper",
    plateNumber: "LAG3803",
    maxiDescription:
      "Sand, granite, construction materials transport. Hydraulic lift enabled for offloading aggregates.",
    isApproved: true,
    isOnline: false,
    maxiImages: [
      require("../../../../assets/dummyMaxiImages/tipper.jpg"),
      require("../../../../assets/dummyMaxiImages/tipper1.jpeg"),
      require("../../../../assets/dummyMaxiImages/tipper2.jpeg"),
    ],
  },
];

const MaxiTypeListScreen = () => {
  const [loading, setLoading] = useState(true);
  const [freightList, setFreightList] = useState([]);

  useEffect(() => {
    // Later → DataStore.query(Courier, c => c.vehicleClass.ne(null))
    setTimeout(() => {
      setFreightList(dummyFreightData);
      setLoading(false);
    }, 800);
  }, []);

  const renderItem = ({ item }) => {
    const coverImage = item.maxiImages?.[0];

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.card, !item.isOnline && { opacity: 0.6 }]}
        onPress={() => router.push(`/screens/searchresults/${item.id}`)}
      >
        <Image source={coverImage} style={styles.image} />

        {/* Availability Badge */}
        <View style={styles.badgeContainer}>
          {item.isOnline && <View style={styles.onlineDot} />}
          <Text style={styles.badgeText}>
            {item.isOnline ? "Available Now" : "Offline"}
          </Text>
        </View>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.model}>{item.model}</Text>
            {item.isApproved && <Text style={styles.verified}>✔ Verified</Text>}
          </View>

          <Text style={styles.vehicleClass}>{item.vehicleClass}</Text>

          <Text style={styles.plate}>Plate: {item.plateNumber}</Text>

          <Text numberOfLines={2} style={styles.description}>
            {item.maxiDescription}
          </Text>

          <View style={styles.bottomRow}>
            <Text style={styles.driver}>Driver: {item.firstName}</Text>

            <Text style={styles.more}>View Details →</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Available Maxi Vehicles</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#111" />
      ) : (
        <FlatList
          data={freightList}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 50 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

export default MaxiTypeListScreen;
