import { useOrderContext } from "@/providers/OrderProvider";
import { Courier } from "@/src/models";
import { DataStore } from "aws-amplify/datastore";
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
import vehicleCategories from "./vehicleCategories";

const MaxiVehicleCategoriesScreen = () => {
  const { setVehicleClass } = useOrderContext();

  const [availableVehicleClasses, setAvailableVehicleClasses] = useState(
    new Set(),
  );

  const [loadingAvailability, setLoadingAvailability] = useState(true);

  useEffect(() => {
    checkVehicleAvailability();
  }, []);

  const checkVehicleAvailability = async () => {
    try {
      setLoadingAvailability(true);

      const couriers = await DataStore.query(Courier);

      const availableClasses = new Set();

      couriers.forEach((courier) => {
        // Vehicle must have a vehicle class
        // and at least one image
        if (
          courier.vehicleClass &&
          Array.isArray(courier.maxiImages) &&
          courier.maxiImages.length > 0
        ) {
          availableClasses.add(courier.vehicleClass);
        }
      });

      setAvailableVehicleClasses(availableClasses);
    } catch (error) {
      console.log("Error checking vehicle availability:", error);

      // If the availability check fails,
      // keep everything disabled for safety.
      setAvailableVehicleClasses(new Set());
    } finally {
      setLoadingAvailability(false);
    }
  };

  const handleSelect = (vehicleClass) => {
    // Do not allow selection if this vehicle class
    // does not have a courier with images.
    if (!availableVehicleClasses.has(vehicleClass)) {
      return;
    }

    setVehicleClass(vehicleClass);

    router.push({
      pathname: "/screens/searchresults/maxicargodetails",
      params: { vehicleClass },
    });
  };

  const handleViewGallery = (vehicleClass) => {
    router.push({
      pathname: "/screens/searchresults/maxivehiclegallery",
      params: { vehicleClass },
    });
  };

  const renderItem = ({ item }) => {
    const isAvailable = availableVehicleClasses.has(item.vehicleClass);

    return (
      <View style={styles.card}>
        <Image source={item.image} style={styles.image} />

        <View style={styles.content}>
          <Text style={styles.title}>{item.title}</Text>

          <Text style={styles.capacity}>{item.capacity}</Text>

          <Text numberOfLines={2} style={styles.description}>
            {item.description}
          </Text>

          <View style={styles.buttonRow}>
            {/* VIEW AVAILABLE VEHICLES */}

            <TouchableOpacity
              style={styles.galleryBtn}
              onPress={() => handleViewGallery(item.vehicleClass)}
            >
              <Text style={styles.galleryText}>View Available Vehicles</Text>
            </TouchableOpacity>

            {/* SELECT */}

            <TouchableOpacity
              style={[
                styles.selectBtn,
                !isAvailable && styles.selectBtnDisabled,
              ]}
              onPress={() => handleSelect(item.vehicleClass)}
              disabled={!isAvailable}
            >
              <Text
                style={[
                  styles.selectText,
                  !isAvailable && styles.selectTextDisabled,
                ]}
              >
                {isAvailable ? "Select" : "Unavailable"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loadingAvailability) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#111" />
        <Text style={styles.loadingText}>Checking vehicle availability...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.header}>Choose Vehicle Type</Text>

      <FlatList
        data={vehicleCategories}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 60,
        }}
      />
    </SafeAreaView>
  );
};

export default MaxiVehicleCategoriesScreen;
