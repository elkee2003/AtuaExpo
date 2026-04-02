// Admin components will be deleted after I add them to admin side
import { useOrderContext } from "@/providers/OrderProvider";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import styles from "./styles";

// Later:
// import { DataStore } from "aws-amplify";
// import { Courier } from "../../../src/models";

const { width } = Dimensions.get("window");

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

const DetailedVehicleScreen = () => {
  const { setVehicleClass, setTransportationType } = useOrderContext();
  const { id } = useLocalSearchParams();
  const [vehicle, setVehicle] = useState(null);

  useEffect(() => {
    // Later:
    // DataStore.query(Courier, id)
    const found = dummyFreightData.find((v) => v.id === id);
    setVehicle(found);
  }, [id]);

  if (!vehicle) return null;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Carousel */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
        >
          {vehicle.maxiImages.map((img, index) => (
            <Image key={index} source={img} style={{ width, height: 260 }} />
          ))}
        </ScrollView>

        {/* Vehicle Info Card */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.model}>{vehicle.model}</Text>

            {vehicle.isApproved && (
              <Text style={styles.verified}>✔ Verified</Text>
            )}
          </View>

          <Text style={styles.vehicleClass}>{vehicle.vehicleClass}</Text>

          <Text style={styles.plate}>Plate Number: {vehicle.plateNumber}</Text>

          {/* Availability */}
          <View style={styles.availabilityRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: vehicle.isOnline ? "#22c55e" : "#9ca3af",
                },
              ]}
            />
            <Text style={styles.statusText}>
              {vehicle.isOnline ? "Currently Available" : "Currently Offline"}
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Description */}
          <Text style={styles.sectionTitle}>Vehicle Description</Text>
          <Text style={styles.description}>{vehicle.maxiDescription}</Text>

          <View style={styles.divider} />

          {/* Driver */}
          <Text style={styles.sectionTitle}>Driver</Text>
          <Text style={styles.driverName}>{vehicle.firstName}</Text>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.requestBtn, !vehicle.isOnline && styles.disabledBtn]}
          disabled={!vehicle.isOnline}
          onPress={() => {
            setVehicleClass(vehicle.vehicleClass);
            setTransportationType(vehicle.transportationType);

            router.push("/screens/searchresults/maxicargodetails");
          }}
        >
          <Text style={styles.requestText}>
            {vehicle.isOnline ? "Request Maxi Quote" : "Driver Offline"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default DetailedVehicleScreen;
