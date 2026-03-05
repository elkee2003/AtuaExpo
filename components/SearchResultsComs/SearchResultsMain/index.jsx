import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { Pressable } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AtuaTypes from "../AtuaTypes";
import ResultMap from "../ResultMap";
import styles from "./styles";

const SearchResultComponent = () => {
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ["30%", "55%"], []);

  const [selectedType, setSelectedType] = useState(null);

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Map */}
      <ResultMap />

      <Pressable onPress={() => router.back()} style={styles.bckBtn}>
        <Ionicons name="arrow-back" style={styles.bckBtnIcon} />
      </Pressable>

      {/* BottomSheet */}
      <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} topInset={1}>
        <BottomSheetScrollView>
          <AtuaTypes
            selectedType={selectedType}
            setSelectedType={setSelectedType}
          />
        </BottomSheetScrollView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
};

export default SearchResultComponent;
