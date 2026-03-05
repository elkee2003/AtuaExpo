import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import React, { useMemo, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import HomeMap from "../HomeMap";
import HomeSearch from "../HomeSearch";
import styles from "./styles";

const HomeComponent = () => {
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ["25%", "37%"], []);
  return (
    // Normally I would have wrapped this in a GestureHandlerRootView here, but instead I wrapped my whole project in the root (where AuthProvider, OrderProvider etc are), so I can just use BottomSheet
    <SafeAreaView style={styles.container}>
      {/* Map */}
      <HomeMap />

      {/* BottomSheet */}
      <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} topInset={1}>
        <BottomSheetScrollView>
          <HomeSearch />
        </BottomSheetScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
};

export default HomeComponent;
