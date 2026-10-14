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

import { SERVICE_RULES } from "@/config/serviceRules";
import { TRANSPORT_TYPES } from "@/constants/transportTypes";
import { pricingEngine } from "@/modules/pricingEngine";
import { formatCurrency } from "@/utils/formatCurrency";
import { getAvailableServices } from "@/utils/getAvailableServices";
import deliveryMediums from "../../../assets/data/types";
import styles from "./styles";

const LOCATION_STALE_AFTER_MS = 3 * 60 * 1000;

const getDistanceKm = (pointA, pointB) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRadians(pointB.latitude - pointA.latitude);
  const dLng = toRadians(pointB.longitude - pointA.longitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(pointA.latitude)) *
      Math.cos(toRadians(pointB.latitude)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(Math.min(1, a)));
};

const AtuaTypes = ({
  selectedType,
  setSelectedType,
  nearbyCouriers = [],
  courierAvailabilityReady = false,
  pickupCoordinates = null,
}) => {
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

  // Filter allowed services by distance rules
  const availableServiceTypes = getAvailableServices(totalKm);

  const filteredDeliveryMediums = deliveryMediums.filter((medium) =>
    availableServiceTypes.includes(medium.type),
  );

  // Micro services
  const isMicroService = (type) =>
    type === TRANSPORT_TYPES.MICRO_EXPRESS ||
    type === TRANSPORT_TYPES.MICRO_BATCH;

  const getServiceAvailability = (type) => {
    // Preserve existing Moto and Maxi behaviour.
    if (!isMicroService(type)) {
      return { available: true, message: null };
    }

    if (!pickupCoordinates) {
      return {
        available: false,
        message: "Choose a pickup location",
      };
    }

    if (!courierAvailabilityReady) {
      return {
        available: false,
        message: "Checking nearby couriers...",
      };
    }

    const maxDistance = SERVICE_RULES[type]?.maxCourierPickupDistanceKm;

    if (typeof maxDistance !== "number" || !Number.isFinite(maxDistance)) {
      return {
        available: false,
        message: "Availability unavailable",
      };
    }

    const now = Date.now();

    const available = nearbyCouriers.some(({ courier, liveLocation }) => {
      if (!courier || !liveLocation) return false;

      if (
        courier.isOnline !== true ||
        courier.isApproved !== true ||
        courier.isBlocked === true ||
        liveLocation.isTracking !== true ||
        courier.transportationType !==
          (type === TRANSPORT_TYPES.MICRO_EXPRESS ||
          type === TRANSPORT_TYPES.MICRO_BATCH
            ? "MICRO"
            : type === TRANSPORT_TYPES.MOTO_EXPRESS ||
                type === TRANSPORT_TYPES.MOTO_BATCH
              ? "MOTO"
              : "MAXI")
      ) {
        return false;
      }

      const { latitude, longitude, lastSeenAt } = liveLocation;

      if (
        typeof latitude !== "number" ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        typeof longitude !== "number" ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180 ||
        !lastSeenAt
      ) {
        return false;
      }

      const timestamp = new Date(lastSeenAt).getTime();

      if (!Number.isFinite(timestamp)) return false;

      const age = now - timestamp;

      if (age < 0 || age > LOCATION_STALE_AFTER_MS) return false;

      return (
        getDistanceKm(pickupCoordinates, { latitude, longitude }) <= maxDistance
      );
    });

    return {
      available,
      message: available ? null : "No courier nearby",
    };
  };

  const selectedAvailability = selectedType
    ? getServiceAvailability(selectedType)
    : null;

  const canContinue = Boolean(
    selectedType &&
    isRouteReady &&
    Number(totalKm) > 0 &&
    Number(totalMins) > 0 &&
    (!isMicroService(selectedType) || selectedAvailability?.available),
  );

  const getImage = (type) => {
    switch (type) {
      case TRANSPORT_TYPES.MICRO_EXPRESS:
        return require("../../../assets/atuaImages/AtuaMicroX.png");

      case TRANSPORT_TYPES.MICRO_BATCH:
        return require("../../../assets/atuaImages/AtuaMicroBatch.png");

      case TRANSPORT_TYPES.MOTO_EXPRESS:
        return require("../../../assets/atuaImages/AtuaMotoX.png");

      case TRANSPORT_TYPES.MOTO_BATCH:
        return require("../../../assets/atuaImages/AtuaMotoBatch.png");

      case TRANSPORT_TYPES.MAXI:
        return require("../../../assets/atuaImages/AtuaMaxi.png");

      default:
        return require("../../../assets/atuaImages/AtuaMicroBatch.png");
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

          const availability = getServiceAvailability(medium.type);
          const isDisabled =
            isMicroService(medium.type) && !availability.available;

          return (
            <TouchableOpacity
              key={medium.id}
              activeOpacity={isDisabled ? 1 : 0.85}
              disabled={isDisabled}
              onPress={() => setSelectedType(medium.type)}
              style={[
                styles.card,
                isSelected && styles.selectedCard,
                isDisabled && styles.disabledCard,
              ]}
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

                {isMicroService(medium.type) && !availability.available && (
                  <Text style={styles.unavailableText}>
                    {availability.message}
                  </Text>
                )}
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
