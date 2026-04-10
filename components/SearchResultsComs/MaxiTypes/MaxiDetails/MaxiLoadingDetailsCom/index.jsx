import { useOrderContext } from "@/providers/OrderProvider";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import styles from "./styles";

const HELPER_OPTIONS = [
  { label: "Handle Myself", value: 0, responsibility: "Handle Myself" },
  { label: "Driver Assists", value: 5000, responsibility: "Driver Assists" },
  {
    label: "Driver +1 Helper",
    value: 10000,
    responsibility: "Driver +1 Helper",
  },
  {
    label: "Full Loading Crew",
    value: 20000,
    responsibility: "Full Loading Crew",
  },
];

const FLOOR_OPTIONS = [
  { label: "Ground Floor", surcharge: 0 },
  { label: "1-2 Floors", surcharge: 3000 },
  { label: "3+ Floors", surcharge: 6000 },
];

export default function MaxiLoadingDetailsScreen() {
  const {
    loadingFee,
    setLoadingFee,

    unloadingFee,
    setUnloadingFee,

    floorSurcharge,
    setFloorSurcharge,

    fragileSurcharge,
    setFragileSurcharge,
    extrasTotal,
    setExtrasTotal,

    pickupLoadingResponsibility,
    setPickupLoadingResponsibility,

    dropoffUnloadingResponsibility,
    setDropoffUnloadingResponsibility,

    pickupFloorLevel,
    setPickupFloorLevel,

    pickupFloorLevelPrice,
    setPickupFloorLevelPrice,

    pickupHasElevator,
    setPickupHasElevator,

    dropoffFloorLevel,
    setDropoffFloorLevel,

    dropoffFloorLevelPrice,
    setDropoffFloorLevelPrice,

    dropoffHasElevator,
    setDropoffHasElevator,

    orderError,
    setOrderError,
  } = useOrderContext();

  const validateLoadingDetails = () => {
    setOrderError("");

    if (!pickupLoadingResponsibility) {
      setOrderError("Select pickup loading responsibility");
      return false;
    }

    if (!pickupFloorLevel) {
      setOrderError("Select pickup floor level");
      return false;
    }

    if (!dropoffUnloadingResponsibility) {
      setOrderError("Select dropoff unloading responsibility");
      return false;
    }

    if (!dropoffFloorLevel) {
      setOrderError("Select dropoff floor level");
      return false;
    }

    return true;
  };

  const computedFloorSurcharge = useMemo(() => {
    const pickupCharge =
      pickupLoadingResponsibility === "Handle Myself"
        ? 0
        : pickupHasElevator
          ? 0
          : pickupFloorLevelPrice;

    const dropoffCharge =
      dropoffUnloadingResponsibility === "Handle Myself"
        ? 0
        : dropoffHasElevator
          ? 0
          : dropoffFloorLevelPrice;

    return pickupCharge + dropoffCharge;
  }, [
    pickupFloorLevelPrice,
    dropoffFloorLevelPrice,
    pickupHasElevator,
    dropoffHasElevator,
    pickupLoadingResponsibility,
    dropoffUnloadingResponsibility,
  ]);

  const computedExtrasTotal =
    (loadingFee || 0) +
    (unloadingFee || 0) +
    (computedFloorSurcharge || 0) +
    (fragileSurcharge || 0);

  useEffect(() => {
    setFloorSurcharge(computedFloorSurcharge);
  }, [computedFloorSurcharge, setFloorSurcharge]);

  useEffect(() => {
    setExtrasTotal(computedExtrasTotal);
  }, [computedExtrasTotal, setExtrasTotal]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView>
        <Text style={styles.title}>Loading & Unloading</Text>

        {/* PICKUP LOADING */}
        <Text style={styles.sectionTitle}>Pickup Loading *</Text>

        {HELPER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.label}
            style={[
              styles.optionCard,
              pickupLoadingResponsibility === opt.responsibility &&
                styles.selectedCard,
            ]}
            onPress={() => {
              setPickupLoadingResponsibility(opt.responsibility);
              setLoadingFee(opt.value);

              // ✅ If "Handle Myself", reset pickup floor surcharge
              if (opt.responsibility === "Handle Myself") {
                setPickupFloorLevelPrice(0);
              }
            }}
          >
            <Text style={styles.optionText}>
              {opt.label} — ₦{opt.value.toLocaleString()}
            </Text>
          </TouchableOpacity>
        ))}

        {/* PICKUP FLOOR */}
        <Text style={styles.sectionTitle}>Pickup Floor *</Text>

        {FLOOR_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.label}
            style={[
              styles.optionCard,
              pickupFloorLevel === opt.label && styles.selectedCard,
            ]}
            onPress={() => {
              setPickupFloorLevel(opt.label);
              setPickupFloorLevelPrice(opt.surcharge);
            }}
          >
            <Text style={styles.optionText}>{opt.label}</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.switchRow}>
          <Text>Elevator Available</Text>
          <Switch
            value={pickupHasElevator}
            onValueChange={setPickupHasElevator}
          />
        </View>

        {/* DROPOFF UNLOADING */}
        <Text style={styles.sectionTitle}>Dropoff Unloading *</Text>

        {HELPER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.label}
            style={[
              styles.optionCard,
              dropoffUnloadingResponsibility === opt.responsibility &&
                styles.selectedCard,
            ]}
            onPress={() => {
              setDropoffUnloadingResponsibility(opt.responsibility);
              setUnloadingFee(opt.value);

              if (opt.responsibility === "Handle Myself") {
                setDropoffFloorLevelPrice(0);
              }
            }}
          >
            <Text style={styles.optionText}>
              {opt.label} — ₦{opt.value.toLocaleString()}
            </Text>
          </TouchableOpacity>
        ))}

        {/* DROPOFF FLOOR */}
        <Text style={styles.sectionTitle}>Dropoff Floor *</Text>

        {FLOOR_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.label}
            style={[
              styles.optionCard,
              dropoffFloorLevel === opt.label && styles.selectedCard,
            ]}
            onPress={() => {
              setDropoffFloorLevel(opt.label);
              setDropoffFloorLevelPrice(opt.surcharge);
            }}
          >
            <Text style={styles.optionText}>{opt.label}</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.switchRow}>
          <Text>Elevator Available</Text>
          <Switch
            value={dropoffHasElevator}
            onValueChange={setDropoffHasElevator}
          />
        </View>

        {/* SUMMARY */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryText}>
            Extras Total: ₦{computedExtrasTotal.toLocaleString()}
          </Text>
        </View>
      </ScrollView>

      {/* Error */}
      {orderError ? <Text style={styles.error}>{orderError}</Text> : null}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => {
          if (!validateLoadingDetails()) return;

          router.push("/screens/searchresults/maxirecipient");
        }}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
