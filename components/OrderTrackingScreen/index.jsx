import { GOOGLE_API_KEY } from "@/keys";
import { Courier, Offer, Order } from "@/src/models";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { DataStore } from "aws-amplify/datastore";
import { getUrl } from "aws-amplify/storage";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Text, View } from "react-native";
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

  const courierAnim = useRef({
    latitude: new Animated.Value(0),
    longitude: new Animated.Value(0),
  }).current;

  const snapPoints = useMemo(() => ["35%", "60%", "85%"], []);

  const [order, setOrder] = useState(null);
  const [courier, setCourier] = useState(null);
  const [courierImageUrl, setCourierImageUrl] = useState(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const driverCardAnim = useRef(new Animated.Value(0)).current;

  // Maxi states
  const [offers, setOffers] = useState([]);

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

  /* ================= FETCH OFFER ================= */
  useEffect(() => {
    const fetchOffers = async () => {
      const result = await DataStore.query(Offer, (o) => o.orderID.eq(orderId));

      // ✅ ONLY COURIER OFFERS (ignore USER initial offer)
      const allOffers = result;

      // ✅ group by courier (latest per courier)
      const latestByCourier = {};

      allOffers.forEach((offer) => {
        if (!offer.courierID) return; // 👈 skip USER offers for grouping

        const existing = latestByCourier[offer.courierID];

        if (
          !existing ||
          new Date(offer.createdAt) > new Date(existing.createdAt)
        ) {
          latestByCourier[offer.courierID] = offer;
        }
      });

      const latestOffers = Object.values(latestByCourier);

      const sorted = latestOffers.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );

      // ✅ attach courier data
      const enriched = await Promise.all(
        sorted.map(async (offer) => {
          const courier = await DataStore.query(Courier, offer.courierID);

          let imageUrl = null;

          if (courier?.profilePic) {
            try {
              const result = await getUrl({
                path: courier.profilePic,
                options: {
                  validateObjectExistence: true,
                },
              });

              imageUrl = result.url.toString();
            } catch (e) {
              imageUrl = null;
            }
          }

          return {
            offer,
            courier: {
              ...courier,
              imageUrl, // 👈 attach ready-to-use URL
            },
          };
        }),
      );

      setOffers(enriched);
    };

    fetchOffers();

    const sub = DataStore.observe(Offer).subscribe((msg) => {
      if (msg.element.orderID === orderId) {
        fetchOffers();
      }
    });

    return () => sub.unsubscribe();
  }, [orderId]);

  /* ================= FETCH COURIER ================= */

  useEffect(() => {
    if (!order?.assignedCourierId) return;

    let subscription;

    const fetchCourier = async () => {
      const data = await DataStore.query(Courier, order.assignedCourierId);
      setCourier(data);
    };

    fetchCourier();

    subscription = DataStore.observe(
      Courier,
      order.assignedCourierId,
    ).subscribe((msg) => {
      setCourier(msg.element);
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [order?.assignedCourierId]);

  // FETCH COURIER PROFILE IMAGE
  useEffect(() => {
    const fetchCourierImage = async () => {
      if (!courier?.profilePic) {
        setCourierImageUrl(null);
        return;
      }

      try {
        const result = await getUrl({
          path: courier.profilePic,
          options: { validateObjectExistence: true },
        });

        setCourierImageUrl(result.url.toString());
      } catch (e) {
        setCourierImageUrl(null);
      }
    };

    fetchCourierImage();
  }, [courier?.profilePic]);

  useEffect(() => {
    if (!courier?.lat || !courier?.lng) return;

    Animated.parallel([
      Animated.timing(courierAnim.latitude, {
        toValue: courier.lat,
        duration: 500,
        useNativeDriver: false,
      }),
      Animated.timing(courierAnim.longitude, {
        toValue: courier.lng,
        duration: 500,
        useNativeDriver: false,
      }),
    ]).start();
  }, [courier?.lat, courier?.lng]);

  useEffect(() => {
    if (!courier?.lat || !courier?.lng) return;

    // ✅ FIRST TIME: set immediately (no animation jump)
    courierAnim.latitude.setValue(courier.lat);
    courierAnim.longitude.setValue(courier.lng);
  }, [courier?.id]); // only when courier first appears

  /* ================= SEARCH PULSE ================= */

  useEffect(() => {
    if (order?.status !== "READY_FOR_PICKUP" && order?.status !== "BIDDING")
      return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
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

  /* ================= USEEFFECT TO CLEAR LIVE ORDER BADGE================= */
  useEffect(() => {
    if (!order) return;

    if (order.hasNewOffer && order.lastOfferSenderType === "COURIER") {
      const timer = setTimeout(async () => {
        const latestOrder = await DataStore.query(Order, order.id);

        await DataStore.save(
          Order.copyOf(latestOrder, (updated) => {
            updated.hasNewOffer = false;
          }),
        );
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [order?.id, order?.hasNewOffer]);

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

  // I have removed this (uploadFinished) as a condition for canStartBidding
  const uploadFinished =
    !order.mediaUploadStatus || order.mediaUploadStatus === "COMPLETE";

  const canStartBidding = order.transportationType === "MAXI";

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
          <Marker.Animated
            coordinate={{
              latitude: courierAnim.latitude,
              longitude: courierAnim.longitude,
            }}
          >
            <Image
              source={
                courierImageUrl
                  ? { uri: courierImageUrl }
                  : require("../../assets/images/placeholder.png")
              }
              style={styles.courierAvatar}
            />
          </Marker.Animated>
        )}
      </MapView>

      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        topInset={1}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetView>
          {order.mediaUploadStatus === "FAILED" && (
            <RetryUploadBanner order={order} />
          )}

          {order.mediaUploadStatus === "UPLOADING" && (
            <View style={styles.uploadContainer}>
              <ActivityIndicator size="small" color="#2E7D32" />
              <Text style={styles.uploadText}>Uploading package images...</Text>
            </View>
          )}

          {canStartBidding && order.status === "BIDDING" ? (
            <MaxiBiddingSheet
              order={order}
              offers={offers}
              expiresAt={order.offerExpiresAt}
              bottomSheetRef={bottomSheetRef}
              onAcceptOffer={async (offer) => {
                if (order.status === "ACCEPTED") return;

                if (offer.senderType !== "COURIER") return;

                try {
                  await DataStore.save(
                    Order.copyOf(order, (updated) => {
                      updated.status = "ACCEPTED";
                      updated.totalPrice = offer.amount;
                      updated.acceptedOfferID = offer.id;
                      updated.assignedCourierId = offer.courierID;
                      updated.hasNewOffer = false;
                    }),
                  );

                  await DataStore.save(
                    Offer.copyOf(offer, (updated) => {
                      updated.status = "ACCEPTED";
                    }),
                  );
                } catch (e) {
                  console.log(e);
                }
              }}
              onCounterOffer={async (offer) => {
                try {
                  await DataStore.save(
                    new Offer({
                      orderID: order.id,
                      courierID: offer.courierID,
                      senderType: "USER",
                      amount: offer.amount,
                      status: "ACTIVE",
                    }),
                  );

                  // ✅ Notify courier
                  const latestOrder = await DataStore.query(Order, order.id);

                  await DataStore.save(
                    Order.copyOf(latestOrder, (updated) => {
                      updated.hasNewOffer = true;
                      updated.lastOfferAt = new Date().toISOString();
                      updated.lastOfferSenderType = "USER";
                    }),
                  );
                } catch (e) {
                  console.log(e);
                }
              }}
              onCancel={() => router.back()}
            />
          ) : (
            <DefaultTrackingSheet
              order={order}
              courier={courier}
              courierImageUrl={courierImageUrl}
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
