import { useOrderContext } from "@/providers/OrderProvider";
import { router } from "expo-router";
import { FlatList, Image, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import styles from "./styles";
import vehicleCategories from "./vehicleCategories";

const MaxiVehicleCategoriesScreen = () => {
  const { setVehicleClass } = useOrderContext();

  const handleSelect = (vehicleClass) => {
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

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Image source={item.image} style={styles.image} />

      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.capacity}>{item.capacity}</Text>

        <Text numberOfLines={2} style={styles.description}>
          {item.description}
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.galleryBtn}
            onPress={() => handleViewGallery(item.vehicleClass)}
          >
            <Text style={styles.galleryText}>View Available Vehicles</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.selectBtn}
            onPress={() => handleSelect(item.vehicleClass)}
          >
            <Text style={styles.selectText}>Select</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.header}>Choose Vehicle Type</Text>

      <FlatList
        data={vehicleCategories}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      />
    </SafeAreaView>
  );
};

export default MaxiVehicleCategoriesScreen;
