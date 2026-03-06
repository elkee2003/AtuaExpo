import { GOOGLE_API_KEY } from "@/keys";
import { Courier, Order } from "@/src/models";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { DataStore } from "aws-amplify/datastore";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { SafeAreaView } from "react-native-safe-area-context";

import DefaultTrackingSheet from "./DefaultTrackingSheet";
import MaxiBiddingSheet from "./Maxi";
import RetryUploadBanner from "./Maxi/RetryUploadBanner";

import styles from "./styles";

const OrderTrackingScreen = ({ orderId }) => {
  const bottomSheetRef = useRef(null);
  const mapRef = useRef(null);

  const snapPoints = useMemo(() => ["30%", "55%"], []);

  const [order, setOrder] = useState(null);
  const [courier, setCourier] = useState(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const driverCardAnim = useRef(new Animated.Value(0)).current;

  // Maxi states
  const [offers, setOffers] = useState([]);
  const [notifiedDriversCount, setNotifiedDriversCount] = useState(0);

  /* ================= FETCH ORDER ================= */

  useEffect(() => {
    const fetchOrder = async () => {
      const data = await DataStore.query(Order, orderId);
      setOrder(data);
    };

    fetchOrder();

    const subscription = DataStore.observe(Order, orderId).subscribe((msg) => {
      setOrder(msg.element);
    });

    return () => subscription.unsubscribe();
  }, [orderId]);

  /* ================= FETCH COURIER ================= */

  useEffect(() => {
    if (!order?.Courier?.id) return;

    const fetchCourier = async () => {
      const data = await DataStore.query(Courier, order.Courier.id);
      setCourier(data);
    };

    fetchCourier();
  }, [order?.Courier?.id]);

  /* ================= SEARCH PULSE ================= */

  useEffect(() => {
    if (order?.status !== "READY_FOR_PICKUP" || order?.status !== "BIDDING")
      return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [order?.status]);

  /* ================= DRIVER ACCEPTED ANIMATION ================= */

  useEffect(() => {
    if (order?.status === "ACCEPTED" && courier?.lat && courier?.lng) {
      // 1️⃣ Animate driver card
      Animated.spring(driverCardAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();

      // 2️⃣ Expand bottom sheet
      bottomSheetRef.current?.expand();

      // 3️⃣ Animate map zoom
      mapRef.current?.animateToRegion(
        {
          latitude: courier.lat,
          longitude: courier.lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        1000,
      );
    }
  }, [order?.status, courier]);

  /* ================= LOADING ================= */

  if (!order) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const origin = {
    latitude: order.originLat,
    longitude: order.originLng,
  };

  const destination = {
    latitude: order.destinationLat,
    longitude: order.destinationLng,
  };

  // Condition to start bidding
  const uploadFinished =
    !order.mediaUploadStatus || order.mediaUploadStatus === "COMPLETE";

  const canStartBidding = order.transportationType === "MAXI" && uploadFinished;

  /* ================= UI ================= */

  return (
    // Normally I would have wrapped this in a GestureHandlerRootView here, but instead I wrapped my whole project in the root (where AuthProvider, OrderProvider etc are), so I can just use BottomSheet
    <SafeAreaView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          ...origin,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        <MapViewDirections
          origin={origin}
          destination={destination}
          apikey={GOOGLE_API_KEY}
          strokeWidth={4}
          strokeColor="red"
        />

        {/* Pickup Marker */}
        <Marker
          coordinate={origin}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={true}
        >
          {order.status === "READY_FOR_PICKUP" || order.status === "BIDDING" ? (
            <View style={{ height: "120", width: "120" }}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: pulseAnim }],
                    opacity: pulseAnim.interpolate({
                      inputRange: [1, 1.4],
                      outputRange: [0.6, 0],
                    }),
                  },
                ]}
              />
              <View style={styles.pulseCore} />
            </View>
          ) : (
            <Ionicons name="ellipse" size={18} color="green" />
          )}
        </Marker>

        {/* Destination Marker */}
        <Marker coordinate={destination} anchor={{ x: 0.5, y: 0.5 }}>
          <Ionicons name="location" size={22} color="red" />
        </Marker>

        {/* Courier Marker */}
        {courier?.lat && courier?.lng && (
          <Marker
            coordinate={{
              latitude: courier.lat,
              longitude: courier.lng,
            }}
          >
            <Image
              source={{ uri: courier.profilePic }}
              style={styles.courierAvatar}
            />
          </Marker>
        )}
      </MapView>

      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        topInset={1}
      >
        <BottomSheetView>
          {order.mediaUploadStatus === "FAILED" && (
            <RetryUploadBanner order={order} uploadEvidence={uploadEvidence} />
          )}

          {canStartBidding && order.status === "BIDDING" ? (
            <MaxiBiddingSheet
              offers={offers}
              notifiedDriversCount={notifiedDriversCount}
              expiresAt={order.offerExpiresAt}
              onAcceptOffer={(offer) => console.log("Accept", offer)}
              onCounterOffer={(offer) => console.log("Counter", offer)}
              onCancel={() => router.back()}
            />
          ) : (
            <DefaultTrackingSheet
              order={order}
              courier={courier}
              driverCardAnim={driverCardAnim}
              onCancel={() => router.back()}
            />
          )}
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
};

export default OrderTrackingScreen;
