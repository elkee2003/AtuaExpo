// In ResultMap remember to uncomment the isApproved query before building for production
import { useLocationContext } from "@/providers/LocationProvider";
import { useOrderContext } from "@/providers/OrderProvider";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TRANSPORT_TYPES } from "@/constants/transportTypes";
import { pricingEngine } from "@/modules/pricingEngine";
import { formatCurrency } from "@/utils/formatCurrency";
import { getAvailableServices } from "@/utils/getAvailableServices";
import deliveryMediums from "../../../assets/data/types";
import styles from "./styles";

const AtuaTypes = ({ selectedType, setSelectedType }) => {
  const {
    setOperationalFare,
    setTotalPrice,
    setCourierEarnings,
    setPlatformFee,
    setCommissionAmount,
    setPlatformServiceRevenue,
    setVatAmount,
    setPlatformNetRevenue,
    setTransportationType,
    resetOrderByTransportType,
  } = useOrderContext();

  const { totalKm, totalMins, isRouteReady } = useLocationContext();

  const canContinue =
    selectedType && isRouteReady && totalKm > 0 && totalMins > 0;

  // Filter allowed services by distance rules
  const availableServiceTypes = getAvailableServices(totalKm);

  const filteredDeliveryMediums = deliveryMediums.filter((medium) =>
    availableServiceTypes.includes(medium.type),
  );

  const getImage = (type) => {
    switch (type) {
      case TRANSPORT_TYPES.MICRO_EXPRESS:
        return require("../../../assets/atuaImages/Walk.png");

      case TRANSPORT_TYPES.MICRO_BATCH:
        return require("../../../assets/atuaImages/Deliverybicycle.png");

      case TRANSPORT_TYPES.MOTO_EXPRESS:
        return require("../../../assets/atuaImages/Bike.jpg");

      case TRANSPORT_TYPES.MOTO_BATCH:
        return require("../../../assets/atuaImages/Deliverybicycle.png");

      case TRANSPORT_TYPES.MAXI:
        return require("../../../assets/atuaImages/UberXL.jpeg");

      default:
        return require("../../../assets/atuaImages/UberXL.jpeg");
    }
  };

  const showInfoAlert = (type) => {
    switch (type) {
      case TRANSPORT_TYPES.MOTO_EXPRESS:
        Alert.alert(
          "Moto Express",
          "Fast delivery using motorcycles or cars. Ideal for medium-distance urgent deliveries.",
        );
        break;

      case TRANSPORT_TYPES.MICRO_EXPRESS:
        Alert.alert(
          "Micro Express",
          "Eco-friendly delivery using bicycles or scooters. Best for short distances.",
        );
        break;

      case TRANSPORT_TYPES.MAXI:
        Alert.alert(
          "Freight / Van",
          "Large-item delivery using vans, pickup trucks, etc. Drivers will bid for your delivery.",
        );
        break;

      case TRANSPORT_TYPES.MOTO_BATCH:
        Alert.alert(
          "Moto Batch",
          "Cost-saving delivery using motorcycles or cars. Delivery with grouped orders.",
        );
        break;

      case TRANSPORT_TYPES.MICRO_BATCH:
        Alert.alert(
          "Micro Batch",
          "Eco-friendly delivery using bicycles or scooters. Best for short distances. Delivery with grouped orders.",
        );
        break;
    }
  };

  const onConfirm = (medium) => {
    resetOrderByTransportType(medium.type);
    setTransportationType(medium.type);

    // Freight → bidding flow
    if (medium.type === TRANSPORT_TYPES.MAXI) {
      router.push("/screens/searchresults/maxitypes");
      return;
    }

    // Instant services → pricing engine
    const priceData = pricingEngine({
      type: medium.type,
      distanceKm: totalKm,
    });

    if (!priceData) {
      Alert.alert("Error", "Unable to calculate price.");
      return;
    }

    setOperationalFare(priceData.operationalFare);
    setTotalPrice(priceData.customerPrice);
    setCourierEarnings(priceData.courierEarnings);
    setPlatformFee(priceData.platformFee);
    setCommissionAmount(priceData.commissionAmount);
    setPlatformServiceRevenue(priceData.platformServiceRevenue);
    setVatAmount(priceData.vatAmount);
    setPlatformNetRevenue(priceData.platformNetRevenue);

    router.push("/screens/orders");
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.distanceText}>
          {totalKm} km • {totalMins} mins
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.listContainer}>
        {filteredDeliveryMediums.map((medium) => {
          const isMaxi = medium.type === TRANSPORT_TYPES.MAXI;

          const priceData = !isMaxi
            ? pricingEngine({
                type: medium.type,
                distanceKm: totalKm,
              })
            : null;

          const isSelected = selectedType === medium.type;

          return (
            <TouchableOpacity
              key={medium.id}
              activeOpacity={0.85}
              onPress={() => setSelectedType(medium.type)}
              style={[styles.card, isSelected && styles.selectedCard]}
            >
              <Image style={styles.image} source={getImage(medium.type)} />

              <View style={styles.content}>
                <View style={styles.titleRow}>
                  <Text style={styles.type}>{medium.label}</Text>
                  <TouchableOpacity onPress={() => showInfoAlert(medium.type)}>
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color="#6b7280"
                      style={styles.infoIcon}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.subtitle}>Fast • Reliable • Secure</Text>
              </View>

              <View style={styles.priceContainer}>
                <Text style={styles.price}>
                  {priceData
                    ? formatCurrency(priceData.customerPrice)
                    : "Get Quotes"}
                </Text>
                <Text style={styles.tag}>est.</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          disabled={!canContinue}
          onPress={() => {
            const selectedMedium = filteredDeliveryMediums.find(
              (m) => m.type === selectedType,
            );

            if (!selectedMedium) return;

            onConfirm(selectedMedium);
          }}
          style={[styles.confirmBtn, !canContinue && styles.confirmBtnDisabled]}
        >
          <Text style={styles.confirmTxt}>
            {!isRouteReady
              ? "Calculating route..."
              : !selectedType
                ? "Select a Service"
                : "Continue"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default AtuaTypes;

// Folder structure here:

// /assets

// /constants
//     transportTypes.js

// /config
//     pricingConfig.js
//     serviceRules.js

// /utils
//     getAvailableServices.js
//     formatCurrency.js

// /modules
//     pricingEngine.js
//     surgeEngine.js
//     biddingEngine.js

// /features
//     instantDelivery/
//     freight/

// Type	Meaning
// constants	vocabulary
// config	business parameters
// utils	small helpers
// modules	business engines
// features	UI flows
