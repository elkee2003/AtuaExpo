// ==================================================
// ORDER TRACKING SCREEN
// ==================================================
// IMPORTANT:
//
// This screen treats DataStore as the local synchronized
// source of the Order.
//
// The Paystack webhook / verifyAtuaPayment Lambda updates
// the Order in the backend.
//
// This screen MUST NOT assume that the first DataStore
// observation contains every field.
//
// We therefore:
// 1. Fetch the Order initially.
// 2. Keep the existing complete Order in state.
// 3. When DataStore observes a change, re-query the Order.
// 4. Merge only defined incoming values.
// 5. Never replace populated fields with undefined.
// 6. Re-check when the app returns to the foreground.
// 7. Briefly retry synchronization after the screen opens.
//
// This prevents a temporary/incomplete DataStore
// observation from making the tracking UI appear blank.
// ==================================================

import { GOOGLE_API_KEY } from "@/keys";
import { Courier, Offer, Order } from "@/src/models";

import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";

import { DataStore } from "aws-amplify/datastore";
import { getUrl } from "aws-amplify/storage";

import { router } from "expo-router";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  Animated,
  AppState,
  Image,
  Text,
  View,
} from "react-native";

import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import MapViewDirections from "react-native-maps-directions";

import { SafeAreaView } from "react-native-safe-area-context";

import DefaultTrackingSheet from "./DefaultTrackingSheet";
import MaxiBiddingSheet from "./Maxi";
import RetryUploadBanner from "./Maxi/RetryUploadBanner";

import styles from "./styles";

// ==================================================
// COORDINATE HELPERS
// ==================================================

const toCoordinate = (value) => {
  //-----------------------------------------
  // Missing Value
  //-----------------------------------------

  if (value === null || value === undefined || value === "") {
    return null;
  }

  //-----------------------------------------
  // Convert To Number
  //-----------------------------------------

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
};

// ==================================================
// VALIDATE COORDINATE
// ==================================================

const isValidCoordinate = (latitude, longitude) => {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};

// ==================================================
// REMOVE UNDEFINED VALUES
// ==================================================
//
// DataStore observations can temporarily give us an
// incomplete representation while synchronization is
// occurring.
//
// We do NOT want:
//
// currentOrder.someField = "ABC"
//
// followed by:
//
// incomingOrder.someField = undefined
//
// to erase "ABC" from the React state.
//
// Only undefined values are removed here.
// Explicit null values are preserved.
// ==================================================

const removeUndefinedValues = (object) => {
  if (!object) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  );
};

// ==================================================
// MERGE ORDER SAFELY
// ==================================================
//
// Existing populated values are preserved when an
// incoming DataStore observation is incomplete.
//
// This is ONLY for React UI state.
//
// It does NOT write anything back to DataStore.
// ==================================================

const mergeOrders = (currentOrder, incomingOrder) => {
  if (!incomingOrder) {
    return currentOrder;
  }

  if (!currentOrder) {
    return incomingOrder;
  }

  return {
    ...currentOrder,

    ...removeUndefinedValues(incomingOrder),
  };
};

// ==================================================
// ORDER TRACKING SCREEN
// ==================================================

const OrderTrackingScreen = ({ orderId }) => {
  // =================================================
  // REFS
  // =================================================

  const bottomSheetRef = useRef(null);

  const mapRef = useRef(null);

  const orderSubscriptionRef = useRef(null);

  const offersSubscriptionRef = useRef(null);

  const courierSubscriptionRef = useRef(null);

  const refreshTimerRef = useRef(null);

  const mountedRef = useRef(true);

  // =================================================
  // COURIER ANIMATED COORDINATES
  // =================================================

  const courierAnim = useRef({
    latitude: new Animated.Value(0),

    longitude: new Animated.Value(0),
  }).current;

  // =================================================
  // BOTTOM SHEET
  // =================================================

  const snapPoints = useMemo(() => ["35%", "60%", "85%"], []);

  // =================================================
  // STATE
  // =================================================

  const [order, setOrder] = useState(null);

  const [courier, setCourier] = useState(null);

  const [courierImageUrl, setCourierImageUrl] = useState(null);

  const [offers, setOffers] = useState([]);

  // =================================================
  // ANIMATIONS
  // =================================================

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const driverCardAnim = useRef(new Animated.Value(0)).current;

  // =================================================
  // MOUNT / UNMOUNT
  // =================================================

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // =================================================
  // FETCH ORDER
  // =================================================
  //
  // IMPORTANT:
  //
  // This function DOES NOT blindly replace the current
  // Order with whatever DataStore gives us.
  //
  // It merges the latest result into the existing state.
  //
  // This is the main protection against the temporary
  // blank-field problem.
  // =================================================

  const refreshOrder = useCallback(
    async ({ reason = "UNKNOWN", log = true } = {}) => {
      if (!orderId) {
        return null;
      }

      try {
        const latestOrder = await DataStore.query(Order, orderId);

        if (!latestOrder) {
          if (log) {
            console.log("ORDER NOT FOUND:", orderId, "REASON:", reason);
          }

          return null;
        }

        if (log) {
          console.log("ORDER REFRESHED FROM DATASTORE:", {
            orderId: latestOrder.id,

            status: latestOrder.status,

            paymentStatus: latestOrder.paymentStatus,

            paymentID: latestOrder.paymentID,

            fundsStatus: latestOrder.fundsStatus,

            deliveryVerificationCode: latestOrder.deliveryVerificationCode,

            assignedCourierId: latestOrder.assignedCourierId,

            version: latestOrder._version,
          });
        }

        if (mountedRef.current) {
          setOrder((currentOrder) => mergeOrders(currentOrder, latestOrder));
        }

        return latestOrder;
      } catch (error) {
        console.log("REFRESH ORDER ERROR:", reason, error);

        return null;
      }
    },
    [orderId],
  );

  // =================================================
  // INITIAL ORDER LOAD + ORDER SUBSCRIPTION
  // =================================================

  useEffect(() => {
    if (!orderId) {
      return;
    }

    let cancelled = false;

    // ------------------------------------------------
    // INITIAL FETCH
    // ------------------------------------------------

    const initialLoad = async () => {
      const latestOrder = await refreshOrder({
        reason: "INITIAL_LOAD",
        log: true,
      });

      if (cancelled || !latestOrder) {
        return;
      }

      // ------------------------------------------------
      // IMPORTANT:
      //
      // After payment, AppSync/DataStore synchronization
      // may not have reached this device immediately.
      //
      // We therefore perform a few short re-checks.
      //
      // This is NOT permanent polling.
      //
      // It only helps the tracking screen converge quickly
      // after a backend Lambda updates the Order.
      // ------------------------------------------------

      const retryDelays = [500, 1500, 3000, 5000, 8000];

      retryDelays.forEach((delay) => {
        setTimeout(async () => {
          if (cancelled || !mountedRef.current) {
            return;
          }

          await refreshOrder({
            reason: `POST_LOAD_SYNC_${delay}MS`,
            log: false,
          });
        }, delay);
      });
    };

    initialLoad();

    // ------------------------------------------------
    // OBSERVE ORDER
    // ------------------------------------------------
    //
    // IMPORTANT:
    //
    // We DO NOT do:
    //
    // setOrder(msg.element)
    //
    // because an observation can be temporarily
    // incomplete.
    //
    // Instead:
    //
    // observation
    //      ↓
    // fresh DataStore query
    //      ↓
    // merge into current React state
    //
    // ------------------------------------------------

    const subscription = DataStore.observe(Order, orderId).subscribe({
      next: async (msg) => {
        if (cancelled || !mountedRef.current) {
          return;
        }

        if (!msg?.element) {
          return;
        }

        console.log("ORDER DATASTORE EVENT:", {
          orderId: msg.element.id,

          status: msg.element.status,

          paymentStatus: msg.element.paymentStatus,

          version: msg.element._version,
        });

        // ------------------------------------------------
        // DO NOT TRUST THE EVENT AS THE COMPLETE ORDER.
        // RE-QUERY DATASTORE.
        // ------------------------------------------------

        await refreshOrder({
          reason: "DATASTORE_ORDER_EVENT",
          log: true,
        });
      },

      error: (error) => {
        console.log("ORDER SUBSCRIPTION ERROR:", error);
      },
    });

    orderSubscriptionRef.current = subscription;

    // ------------------------------------------------
    // CLEANUP
    // ------------------------------------------------

    return () => {
      cancelled = true;

      subscription?.unsubscribe();

      orderSubscriptionRef.current = null;
    };
  }, [orderId, refreshOrder]);

  // =================================================
  // REFRESH WHEN APP RETURNS TO FOREGROUND
  // =================================================
  //
  // This is especially important because you said:
  //
  // "If I close the app and open it, the fields return."
  //
  // Instead of requiring a complete app restart, we
  // explicitly refresh the Order whenever this screen
  // returns to the foreground.
  // =================================================

  useEffect(() => {
    if (!orderId) {
      return;
    }

    const handleAppStateChange = (nextState) => {
      if (nextState === "active") {
        console.log("APP ACTIVE - REFRESHING TRACKED ORDER");

        refreshOrder({
          reason: "APP_RETURNED_TO_FOREGROUND",
          log: true,
        });
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, [orderId, refreshOrder]);

  // =================================================
  // FETCH OFFERS
  // =================================================

  useEffect(() => {
    if (!orderId) {
      return;
    }

    let cancelled = false;

    const fetchOffers = async () => {
      try {
        const result = await DataStore.query(Offer, (o) =>
          o.orderID.eq(orderId),
        );

        if (cancelled) {
          return;
        }

        // ---------------------------------------------
        // Latest Offer Per Courier
        // ---------------------------------------------

        const latestByCourier = {};

        result.forEach((offer) => {
          // -------------------------------------------
          // Ignore User Initial Offers
          // -------------------------------------------

          if (!offer.courierID) {
            return;
          }

          const existing = latestByCourier[offer.courierID];

          if (
            !existing ||
            new Date(offer.createdAt) > new Date(existing.createdAt)
          ) {
            latestByCourier[offer.courierID] = offer;
          }
        });

        // ---------------------------------------------
        // Convert To Array
        // ---------------------------------------------

        const latestOffers = Object.values(latestByCourier);

        // ---------------------------------------------
        // Sort Newest First
        // ---------------------------------------------

        const sorted = latestOffers.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        );

        // ---------------------------------------------
        // Attach Courier Information
        // ---------------------------------------------

        const enriched = await Promise.all(
          sorted.map(async (offer) => {
            const offerCourier = await DataStore.query(
              Courier,
              offer.courierID,
            );

            let imageUrl = null;

            // -----------------------------------
            // Courier Image
            // -----------------------------------

            if (offerCourier?.profilePic) {
              try {
                const imageResult = await getUrl({
                  path: offerCourier.profilePic,

                  options: {
                    validateObjectExistence: true,
                  },
                });

                imageUrl = imageResult.url.toString();
              } catch (error) {
                console.log("OFFER COURIER IMAGE ERROR:", error);

                imageUrl = null;
              }
            }

            return {
              offer,

              courier: {
                ...offerCourier,

                imageUrl,
              },
            };
          }),
        );

        if (!cancelled && mountedRef.current) {
          setOffers(enriched);
        }
      } catch (error) {
        console.log("FETCH OFFERS ERROR:", error);
      }
    };

    // ---------------------------------------------
    // Initial Fetch
    // ---------------------------------------------

    fetchOffers();

    // ---------------------------------------------
    // Observe Offers
    // ---------------------------------------------

    const subscription = DataStore.observe(Offer).subscribe({
      next: (msg) => {
        if (msg?.element?.orderID === orderId) {
          fetchOffers();
        }
      },

      error: (error) => {
        console.log("OFFER SUBSCRIPTION ERROR:", error);
      },
    });

    offersSubscriptionRef.current = subscription;

    // ---------------------------------------------
    // Cleanup
    // ---------------------------------------------

    return () => {
      cancelled = true;

      subscription?.unsubscribe();

      offersSubscriptionRef.current = null;
    };
  }, [orderId]);

  // =================================================
  // FETCH ASSIGNED COURIER
  // =================================================

  useEffect(() => {
    //-----------------------------------------
    // No Courier Yet
    //-----------------------------------------

    if (!order?.assignedCourierId) {
      setCourier(null);

      setCourierImageUrl(null);

      return;
    }

    let cancelled = false;

    const courierId = order.assignedCourierId;

    const fetchCourier = async () => {
      try {
        const data = await DataStore.query(Courier, courierId);

        if (!cancelled && mountedRef.current) {
          setCourier(data || null);
        }
      } catch (error) {
        console.log("FETCH COURIER ERROR:", error);
      }
    };

    //-----------------------------------------
    // Initial Fetch
    //-----------------------------------------

    fetchCourier();

    //-----------------------------------------
    // Observe Courier
    //-----------------------------------------

    const subscription = DataStore.observe(Courier, courierId).subscribe({
      next: async (msg) => {
        if (cancelled || !msg?.element) {
          return;
        }

        // -------------------------------------------
        // Re-query instead of blindly replacing the
        // courier object with an event payload.
        // -------------------------------------------

        try {
          const latestCourier = await DataStore.query(Courier, courierId);

          if (latestCourier && !cancelled && mountedRef.current) {
            setCourier((currentCourier) =>
              mergeOrders(currentCourier, latestCourier),
            );
          }
        } catch (error) {
          console.log("REFRESH COURIER AFTER EVENT ERROR:", error);
        }
      },

      error: (error) => {
        console.log("COURIER SUBSCRIPTION ERROR:", error);
      },
    });

    courierSubscriptionRef.current = subscription;

    //-----------------------------------------
    // Cleanup
    //-----------------------------------------

    return () => {
      cancelled = true;

      subscription?.unsubscribe();

      courierSubscriptionRef.current = null;
    };
  }, [order?.assignedCourierId]);

  // =================================================
  // FETCH COURIER PROFILE IMAGE
  // =================================================

  useEffect(() => {
    let active = true;

    const fetchCourierImage = async () => {
      //---------------------------------
      // No Profile Image
      //---------------------------------

      if (!courier?.profilePic) {
        if (active) {
          setCourierImageUrl(null);
        }

        return;
      }

      //---------------------------------
      // Get S3 URL
      //---------------------------------

      try {
        const result = await getUrl({
          path: courier.profilePic,

          options: {
            validateObjectExistence: true,
          },
        });

        if (active) {
          setCourierImageUrl(result.url.toString());
        }
      } catch (error) {
        console.log("COURIER IMAGE ERROR:", error);

        if (active) {
          setCourierImageUrl(null);
        }
      }
    };

    fetchCourierImage();

    //-------------------------------------
    // Cleanup
    //-------------------------------------

    return () => {
      active = false;
    };
  }, [courier?.profilePic]);

  // =================================================
  // SET INITIAL COURIER LOCATION
  // =================================================

  useEffect(() => {
    //-----------------------------------------
    // Convert Coordinates
    //-----------------------------------------

    const courierLat = toCoordinate(courier?.lat);

    const courierLng = toCoordinate(courier?.lng);

    //-----------------------------------------
    // Validate
    //-----------------------------------------

    if (!isValidCoordinate(courierLat, courierLng)) {
      return;
    }

    //-----------------------------------------
    // Set Immediately
    //-----------------------------------------

    courierAnim.latitude.setValue(courierLat);

    courierAnim.longitude.setValue(courierLng);
  }, [courier?.id, courierAnim]);

  // =================================================
  // ANIMATE COURIER LOCATION
  // =================================================

  useEffect(() => {
    //-----------------------------------------
    // Convert Coordinates
    //-----------------------------------------

    const courierLat = toCoordinate(courier?.lat);

    const courierLng = toCoordinate(courier?.lng);

    //-----------------------------------------
    // Validate
    //-----------------------------------------

    if (!isValidCoordinate(courierLat, courierLng)) {
      return;
    }

    //-----------------------------------------
    // Animate Marker
    //-----------------------------------------

    Animated.parallel([
      Animated.timing(courierAnim.latitude, {
        toValue: courierLat,

        duration: 500,

        useNativeDriver: false,
      }),

      Animated.timing(courierAnim.longitude, {
        toValue: courierLng,

        duration: 500,

        useNativeDriver: false,
      }),
    ]).start();
  }, [courier?.lat, courier?.lng, courierAnim]);

  // =================================================
  // SEARCH PULSE
  // =================================================

  useEffect(() => {
    //-----------------------------------------
    // Only Pulse While Searching/Bidding
    //-----------------------------------------

    if (order?.status !== "READY_FOR_PICKUP" && order?.status !== "BIDDING") {
      pulseAnim.setValue(1);

      return;
    }

    //-----------------------------------------
    // Animation
    //-----------------------------------------

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

    //-----------------------------------------
    // Cleanup
    //-----------------------------------------

    return () => {
      animation.stop();
    };
  }, [order?.status, pulseAnim]);

  // =================================================
  // DRIVER ACCEPTED ANIMATION
  // =================================================

  useEffect(() => {
    //-----------------------------------------
    // Only When Accepted
    //-----------------------------------------

    if (order?.status !== "ACCEPTED") {
      return;
    }

    //-----------------------------------------
    // Convert Courier Coordinates
    //-----------------------------------------

    const courierLat = toCoordinate(courier?.lat);

    const courierLng = toCoordinate(courier?.lng);

    //-----------------------------------------
    // Validate
    //-----------------------------------------

    if (!isValidCoordinate(courierLat, courierLng)) {
      return;
    }

    //-----------------------------------------
    // Animate Driver Card
    //-----------------------------------------

    Animated.spring(driverCardAnim, {
      toValue: 1,

      useNativeDriver: true,
    }).start();

    //-----------------------------------------
    // Expand Bottom Sheet
    //-----------------------------------------

    bottomSheetRef.current?.expand();

    //-----------------------------------------
    // Move Map To Courier
    //-----------------------------------------

    mapRef.current?.animateToRegion(
      {
        latitude: courierLat,

        longitude: courierLng,

        latitudeDelta: 0.02,

        longitudeDelta: 0.02,
      },

      1000,
    );
  }, [order?.status, courier?.lat, courier?.lng, driverCardAnim]);

  // =================================================
  // CLEAR LIVE ORDER BADGE
  // =================================================

  useEffect(() => {
    if (!order) {
      return;
    }

    if (!order.hasNewOffer || order.lastOfferSenderType !== "COURIER") {
      return;
    }

    //-------------------------------------
    // Clear Badge After Delay
    //-------------------------------------

    const timer = setTimeout(
      async () => {
        try {
          const latestOrder = await DataStore.query(Order, order.id);

          if (!latestOrder) {
            return;
          }

          await DataStore.save(
            Order.copyOf(
              latestOrder,

              (updated) => {
                updated.hasNewOffer = false;
              },
            ),
          );

          // -----------------------------------------
          // Refresh React state from the record
          // we just saved.
          // -----------------------------------------

          await refreshOrder({
            reason: "CLEAR_OFFER_BADGE",
            log: false,
          });
        } catch (error) {
          console.log("CLEAR OFFER BADGE ERROR:", error);
        }
      },

      1500,
    );

    //-------------------------------------
    // Cleanup
    //-------------------------------------

    return () => {
      clearTimeout(timer);
    };
  }, [order?.id, order?.hasNewOffer, order?.lastOfferSenderType, refreshOrder]);

  // =================================================
  // LOADING ORDER
  // =================================================

  if (!order) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />

        <Text>Loading order...</Text>
      </View>
    );
  }

  // =================================================
  // ORDER COORDINATES
  // =================================================

  const originLatitude = toCoordinate(order.originLat);

  const originLongitude = toCoordinate(order.originLng);

  const destinationLatitude = toCoordinate(order.destinationLat);

  const destinationLongitude = toCoordinate(order.destinationLng);

  //-----------------------------------------
  // Validate Origin
  //-----------------------------------------

  const hasValidOrigin = isValidCoordinate(originLatitude, originLongitude);

  //-----------------------------------------
  // Validate Destination
  //-----------------------------------------

  const hasValidDestination = isValidCoordinate(
    destinationLatitude,
    destinationLongitude,
  );

  //-----------------------------------------
  // Build Origin
  //-----------------------------------------

  const origin = hasValidOrigin
    ? {
        latitude: originLatitude,

        longitude: originLongitude,
      }
    : null;

  //-----------------------------------------
  // Build Destination
  //-----------------------------------------

  const destination = hasValidDestination
    ? {
        latitude: destinationLatitude,

        longitude: destinationLongitude,
      }
    : null;

  //-----------------------------------------
  // Can Render Map
  //-----------------------------------------

  const canRenderMap = Boolean(origin && destination);

  // =================================================
  // COURIER COORDINATES
  // =================================================

  const courierLatitude = toCoordinate(courier?.lat);

  const courierLongitude = toCoordinate(courier?.lng);

  const hasValidCourierLocation = isValidCoordinate(
    courierLatitude,
    courierLongitude,
  );

  // =================================================
  // MAXI CONDITIONS
  // =================================================

  const canStartBidding = order.transportationType === "MAXI";

  // =================================================
  // ACCEPT MAXI OFFER
  // =================================================

  const handleAcceptOffer = async (offer) => {
    //-------------------------------------
    // Already Accepted
    //-------------------------------------

    if (order.status === "ACCEPTED") {
      return;
    }

    //-------------------------------------
    // Must Be Courier Offer
    //-------------------------------------

    if (offer.senderType !== "COURIER") {
      return;
    }

    //-------------------------------------
    // Save
    //-------------------------------------

    try {
      //---------------------------------
      // Get Latest Order
      //---------------------------------

      const latestOrder = await DataStore.query(Order, order.id);

      if (!latestOrder) {
        return;
      }

      //---------------------------------
      // Update Order
      //---------------------------------

      const updatedOrder = await DataStore.save(
        Order.copyOf(
          latestOrder,

          (updated) => {
            updated.status = "ACCEPTED";

            updated.totalPrice = offer.amount;

            updated.acceptedOfferID = offer.id;

            updated.assignedCourierId = offer.courierID;

            updated.hasNewOffer = false;
          },
        ),
      );

      //---------------------------------
      // Immediately update UI with the
      // actual saved object.
      //---------------------------------

      if (updatedOrder && mountedRef.current) {
        setOrder((currentOrder) => mergeOrders(currentOrder, updatedOrder));
      }

      //---------------------------------
      // Get Latest Offer
      //---------------------------------

      const latestOffer = await DataStore.query(Offer, offer.id);

      if (latestOffer) {
        //---------------------------------
        // Update Offer
        //---------------------------------

        await DataStore.save(
          Offer.copyOf(
            latestOffer,

            (updated) => {
              updated.status = "ACCEPTED";
            },
          ),
        );
      }
    } catch (error) {
      console.log("ACCEPT OFFER ERROR:", error);
    }
  };

  // =================================================
  // COUNTER MAXI OFFER
  // =================================================

  const handleCounterOffer = async (offer) => {
    try {
      //-------------------------------------
      // Create User Counter Offer
      //-------------------------------------

      await DataStore.save(
        new Offer({
          orderID: order.id,

          courierID: offer.courierID,

          senderType: "USER",

          amount: offer.amount,

          status: "ACTIVE",
        }),
      );

      //-------------------------------------
      // Get Latest Order
      //-------------------------------------

      const latestOrder = await DataStore.query(Order, order.id);

      if (!latestOrder) {
        return;
      }

      //-------------------------------------
      // Notify Courier
      //-------------------------------------

      const updatedOrder = await DataStore.save(
        Order.copyOf(
          latestOrder,

          (updated) => {
            updated.hasNewOffer = true;

            updated.lastOfferAt = new Date().toISOString();

            updated.lastOfferSenderType = "USER";
          },
        ),
      );

      //-------------------------------------
      // Update UI from actual saved record
      //-------------------------------------

      if (updatedOrder && mountedRef.current) {
        setOrder((currentOrder) => mergeOrders(currentOrder, updatedOrder));
      }
    } catch (error) {
      console.log("COUNTER OFFER ERROR:", error);
    }
  };

  // =================================================
  // UI
  // =================================================

  return (
    <SafeAreaView style={styles.container}>
      {/* =====================================
          MAP
      ===================================== */}

      {canRenderMap ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: origin.latitude,

            longitude: origin.longitude,

            latitudeDelta: 0.05,

            longitudeDelta: 0.05,
          }}
        >
          {/* =================================
              ROUTE
          ================================= */}

          <MapViewDirections
            origin={origin}
            destination={destination}
            apikey={GOOGLE_API_KEY}
            strokeWidth={4}
            strokeColor="red"
            onError={(error) => {
              console.log("MAP DIRECTIONS ERROR:", error);
            }}
          />

          {/* =================================
              PICKUP MARKER
          ================================= */}

          <Marker
            coordinate={origin}
            anchor={{
              x: 0.5,
              y: 0.5,
            }}
            tracksViewChanges={true}
          >
            {order.status === "READY_FOR_PICKUP" ||
            order.status === "BIDDING" ? (
              <View
                style={{
                  height: 120,
                  width: 120,
                }}
              >
                <Animated.View
                  style={[
                    styles.pulseRing,

                    {
                      transform: [
                        {
                          scale: pulseAnim,
                        },
                      ],

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

          {/* =================================
              DESTINATION MARKER
          ================================= */}

          <Marker
            coordinate={destination}
            anchor={{
              x: 0.5,
              y: 0.5,
            }}
          >
            <Ionicons name="location" size={22} color="red" />
          </Marker>

          {/* =================================
              COURIER MARKER
          ================================= */}

          {hasValidCourierLocation && (
            <Marker.Animated
              coordinate={{
                latitude: courierAnim.latitude,

                longitude: courierAnim.longitude,
              }}
            >
              <Image
                source={
                  courierImageUrl
                    ? {
                        uri: courierImageUrl,
                      }
                    : require("../../assets/images/placeholder.png")
                }
                style={styles.courierAvatar}
              />
            </Marker.Animated>
          )}
        </MapView>
      ) : (
        /* =====================================
           INVALID / MISSING MAP COORDINATES
        ===================================== */

        <View style={styles.loader}>
          <ActivityIndicator size="large" />

          <Text>Loading delivery map...</Text>
        </View>
      )}

      {/* =====================================
          BOTTOM SHEET
      ===================================== */}

      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        topInset={1}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetView>
          {/* =================================
              FAILED MEDIA UPLOAD
          ================================= */}

          {order.mediaUploadStatus === "FAILED" && (
            <RetryUploadBanner order={order} />
          )}

          {/* =================================
              MEDIA UPLOADING
          ================================= */}

          {order.mediaUploadStatus === "UPLOADING" && (
            <View style={styles.uploadContainer}>
              <ActivityIndicator size="small" color="#2E7D32" />

              <Text style={styles.uploadText}>Uploading package images...</Text>
            </View>
          )}

          {/* =================================
              MAXI BIDDING
          ================================= */}

          {canStartBidding && order.status === "BIDDING" ? (
            <MaxiBiddingSheet
              order={order}
              offers={offers}
              expiresAt={order.offerExpiresAt}
              bottomSheetRef={bottomSheetRef}
              onAcceptOffer={handleAcceptOffer}
              onCounterOffer={handleCounterOffer}
              onCancel={() => router.back()}
            />
          ) : (
            /* =================================
               NORMAL TRACKING
            ================================= */

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
