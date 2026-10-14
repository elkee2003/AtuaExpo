import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { Pressable } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useLocationContext } from "@/providers/LocationProvider";
import AtuaTypes from "../AtuaTypes";
import ResultMap from "../ResultMap";
import styles from "./styles";

const SearchResultComponent = () => {
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ["30%", "55%"], []);

  const [selectedType, setSelectedType] = useState(null);
  const [nearbyCouriers, setNearbyCouriers] = useState(null);

  const { originAddress } = useLocationContext();

  // Use only the actual selected pickup coordinates.
  // Do not use ResultMap's fallback coordinates for availability.
  const pickupCoordinates = useMemo(() => {
    const lat = Number(originAddress?.details?.geometry?.location?.lat);
    const lng = Number(originAddress?.details?.geometry?.location?.lng);

    if (
      originAddress?.details?.geometry?.location?.lat == null ||
      originAddress?.details?.geometry?.location?.lng == null ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null;
    }

    return { latitude: lat, longitude: lng };
  }, [originAddress]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <ResultMap onCouriersChange={setNearbyCouriers} />

      <Pressable onPress={() => router.back()} style={styles.bckBtn}>
        <Ionicons name="arrow-back" style={styles.bckBtnIcon} />
      </Pressable>

      <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} topInset={1}>
        <BottomSheetScrollView>
          <AtuaTypes
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            nearbyCouriers={nearbyCouriers ?? []}
            courierAvailabilityReady={nearbyCouriers !== null}
            pickupCoordinates={pickupCoordinates}
          />
        </BottomSheetScrollView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
};

export default SearchResultComponent;
