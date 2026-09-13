// ==================================================
// ORDER TRACKING SCREEN
// ==================================================
//
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
// Courier location:
//
// The assigned courier's live position comes from
// CourierLiveLocation, NOT Courier.lat / Courier.lng.
//
// Courier is still used for profile information such as:
// - firstName
// - transportationType
// - profilePic
//
// CourierLiveLocation is used for:
// - latitude
// - longitude
// - heading
// - speed
// - accuracy
// - isTracking
// - lastSeenAt
// ==================================================

import { GOOGLE_API_KEY } from "@/keys";
import { Courier, CourierLiveLocation, Offer, Order } from "@/src/models";

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

/**
 * Safely convert a value into a number.
 *
 * This protects the map from null, undefined, empty strings,
 * or values that cannot be converted into valid numbers.
 */
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

  //-----------------------------------------
  // Invalid Number
  //-----------------------------------------

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
};

// ==================================================
// VALIDATE COORDINATE
// ==================================================

/**
 * Make sure latitude and longitude are actually
 * valid geographic coordinates.
 */
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
// MERGE OBJECTS SAFELY
// ==================================================
//
// This is used for React UI state only.
//
// It does NOT write anything back to DataStore.
// ==================================================

const mergeOrders = (currentObject, incomingObject) => {
  if (!incomingObject) {
    return currentObject;
  }

  if (!currentObject) {
    return incomingObject;
  }

  return {
    ...currentObject,
    ...removeUndefinedValues(incomingObject),
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

  const hasInitializedCourierPositionRef = useRef(false);

  // NEW:
  // Dedicated subscription reference for the assigned
  // courier's live GPS location.
  const courierLiveLocationSubscriptionRef = useRef(null);

  const refreshTimersRef = useRef([]);

  const mountedRef = useRef(true);

  // =================================================
  // COURIER ANIMATED COORDINATES
  // =================================================
  //
  // These Animated.Values drive Marker.Animated.
  //
  // They now receive coordinates from
  // CourierLiveLocation instead of Courier.lat/lng.
  // =================================================

  const courierAnim = useRef({
    latitude: new Animated.Value(0),
    longitude: new Animated.Value(0),
  }).current;

  // =================================================
  // RESET COURIER POSITION WHEN COURIER CHANGES
  // =================================================
  //
  // When the order is reassigned to another courier,
  // reset the marker initialization so the new courier
  // does not animate from the previous courier's location.
  //
  // =================================================

  useEffect(() => {
    // Reset marker initialization whenever the
    // assigned courier changes.
    hasInitializedCourierPositionRef.current = false;

    // Stop any previous courier animation.
    courierAnim.latitude.stopAnimation();
    courierAnim.longitude.stopAnimation();
  }, [order?.assignedCourierId, courierAnim]);

  // =================================================
  // BOTTOM SHEET
  // =================================================

  const snapPoints = useMemo(() => ["35%", "60%", "85%"], []);

  // =================================================
  // STATE
  // =================================================

  const [order, setOrder] = useState(null);

  const [courier, setCourier] = useState(null);

  const [isMapReady, setIsMapReady] = useState(false);

  const [isFollowingCourier, setIsFollowingCourier] = useState(true);

  // NEW:
  // Current live location for the assigned courier.
  const [courierLiveLocation, setCourierLiveLocation] = useState(null);

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
      // POST LOAD SYNC RETRIES
      // ------------------------------------------------
      //
      // These are only short synchronization checks
      // after opening the tracking screen.
      //
      // They help after a backend Lambda updates the
      // Order but the local DataStore has not synchronized
      // the new values immediately.
      // ------------------------------------------------

      const retryDelays = [500, 1500, 3000, 5000, 8000];

      retryDelays.forEach((delay) => {
        const timer = setTimeout(async () => {
          if (cancelled || !mountedRef.current) {
            return;
          }

          await refreshOrder({
            reason: `POST_LOAD_SYNC_${delay}MS`,
            log: false,
          });
        }, delay);

        refreshTimersRef.current.push(timer);
      });
    };

    initialLoad();

    // ------------------------------------------------
    // OBSERVE ORDER
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

      refreshTimersRef.current.forEach((timer) => {
        clearTimeout(timer);
      });

      refreshTimersRef.current = [];

      orderSubscriptionRef.current = null;
    };
  }, [orderId, refreshOrder]);

  // =================================================
  // REFRESH WHEN APP RETURNS TO FOREGROUND
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
  //
  // This loads the courier profile.
  //
  // It intentionally does NOT load courier coordinates.
  // Coordinates come from CourierLiveLocation below.
  // =================================================

  useEffect(() => {
    //-----------------------------------------
    // No Courier Yet
    //-----------------------------------------

    if (!order?.assignedCourierId) {
      setCourier(null);
      setCourierImageUrl(null);

      // Clear any previous live location.
      setCourierLiveLocation(null);

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
  // FETCH ASSIGNED COURIER LIVE LOCATION
  // =================================================
  //
  // IMPORTANT:
  //
  // This is now the PRIMARY source for the courier's
  // current position.
  //
  // We only subscribe to the CourierLiveLocation
  // belonging to the assigned courier.
  //
  // We do NOT subscribe to every courier in the
  // system from this tracking screen.
  // =================================================

  useEffect(() => {
    const courierId = order?.assignedCourierId;

    //-----------------------------------------
    // No Assigned Courier
    //-----------------------------------------

    if (!courierId) {
      setCourierLiveLocation(null);

      return;
    }

    let cancelled = false;

    //-----------------------------------------
    // Fetch Current Live Location
    //-----------------------------------------

    const fetchCourierLiveLocation = async () => {
      try {
        const locations = await DataStore.query(
          CourierLiveLocation,
          (location) => location.courierID.eq(courierId),
        );

        if (cancelled || !mountedRef.current) {
          return;
        }

        /**
         * There should normally be one current
         * CourierLiveLocation per courier because
         * Courier.liveLocationID points to the
         * courier's current live-location record.
         *
         * If multiple records somehow exist, use
         * the newest one based on lastSeenAt.
         */
        const latestLocation =
          locations
            .filter((location) => location?.courierID === courierId)
            .sort((a, b) => {
              const timeA = new Date(a?.lastSeenAt).getTime() || 0;

              const timeB = new Date(b?.lastSeenAt).getTime() || 0;

              return timeB - timeA;
            })[0] || null;

        setCourierLiveLocation(latestLocation);

        if (latestLocation) {
          console.log("COURIER LIVE LOCATION LOADED:", {
            courierId: latestLocation.courierID,
            latitude: latestLocation.latitude,
            longitude: latestLocation.longitude,
            heading: latestLocation.heading,
            speed: latestLocation.speed,
            isTracking: latestLocation.isTracking,
            lastSeenAt: latestLocation.lastSeenAt,
          });
        } else {
          console.log("NO COURIER LIVE LOCATION FOUND:", courierId);
        }
      } catch (error) {
        console.log("FETCH COURIER LIVE LOCATION ERROR:", error);
      }
    };

    //-----------------------------------------
    // Initial Fetch
    //-----------------------------------------

    fetchCourierLiveLocation();

    //-----------------------------------------
    // Observe ONLY This Courier's Location
    //-----------------------------------------
    //
    // The predicate prevents this screen from
    // processing live-location updates for every
    // other courier in the system.
    // -----------------------------------------

    const subscription = DataStore.observe(CourierLiveLocation, (location) =>
      location.courierID.eq(courierId),
    ).subscribe({
      next: (msg) => {
        if (cancelled || !mountedRef.current || !msg?.element) {
          return;
        }

        const element = msg.element;

        /**
         * Extra safety check.
         */
        if (element.courierID !== courierId) {
          return;
        }

        console.log("COURIER LIVE LOCATION EVENT:", {
          opType: msg.opType,
          courierId: element.courierID,
          latitude: element.latitude,
          longitude: element.longitude,
          heading: element.heading,
          speed: element.speed,
          isTracking: element.isTracking,
          lastSeenAt: element.lastSeenAt,
        });

        //-----------------------------------------
        // INSERT
        //-----------------------------------------

        if (msg.opType === "INSERT") {
          setCourierLiveLocation(element);

          return;
        }

        //-----------------------------------------
        // UPDATE
        //-----------------------------------------

        if (msg.opType === "UPDATE") {
          setCourierLiveLocation((currentLocation) =>
            mergeOrders(currentLocation, element),
          );

          return;
        }

        //-----------------------------------------
        // DELETE
        //-----------------------------------------

        if (msg.opType === "DELETE") {
          setCourierLiveLocation(null);
        }
      },

      error: (error) => {
        console.log("COURIER LIVE LOCATION SUBSCRIPTION ERROR:", error);
      },
    });

    courierLiveLocationSubscriptionRef.current = subscription;

    //-----------------------------------------
    // Cleanup
    //-----------------------------------------

    return () => {
      cancelled = true;

      subscription?.unsubscribe();

      courierLiveLocationSubscriptionRef.current = null;
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
  //
  // This now uses CourierLiveLocation.
  //
  // We do this immediately whenever a new live location
  // becomes available so the marker does not start from
  // coordinate 0,0.
  // =================================================

  useEffect(() => {
    //-----------------------------------------
    // Convert Coordinates
    //-----------------------------------------

    const courierLat = toCoordinate(courierLiveLocation?.latitude);

    const courierLng = toCoordinate(courierLiveLocation?.longitude);

    //-----------------------------------------
    // Validate
    //-----------------------------------------

    if (!isValidCoordinate(courierLat, courierLng)) {
      return;
    }

    //-----------------------------------------
    // Set Immediately
    //-----------------------------------------

    if (!hasInitializedCourierPositionRef.current) {
      courierAnim.latitude.setValue(courierLat);
      courierAnim.longitude.setValue(courierLng);

      hasInitializedCourierPositionRef.current = true;
    }
  }, [
    courierLiveLocation?.id,
    courierLiveLocation?.latitude,
    courierLiveLocation?.longitude,
    courierAnim,
  ]);

  // =================================================
  // ANIMATE COURIER LOCATION
  // =================================================
  //
  // Every CourierLiveLocation update comes through here.
  //
  // Example:
  //
  // old:
  // 4.8100, 7.0100
  //
  // new:
  // 4.8110, 7.0115
  //
  // The marker smoothly animates between them.
  // =================================================

  useEffect(() => {
    //-----------------------------------------
    // Convert Coordinates
    //-----------------------------------------

    const courierLat = toCoordinate(courierLiveLocation?.latitude);

    const courierLng = toCoordinate(courierLiveLocation?.longitude);

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
        duration: 700,
        useNativeDriver: false,
      }),

      Animated.timing(courierAnim.longitude, {
        toValue: courierLng,
        duration: 700,
        useNativeDriver: false,
      }),
    ]).start();
  }, [
    courierLiveLocation?.latitude,
    courierLiveLocation?.longitude,
    courierAnim,
  ]);

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

  // ==================================================
  // COURIER CAMERA FOLLOW WITH HEADING
  // ==================================================
  //
  // This keeps the camera centered on the courier and
  // rotates the camera according to the courier's
  // latest heading when available.
  // ==================================================

  useEffect(() => {
    //-----------------------------------------
    // Delivery Statuses That Should Follow
    //-----------------------------------------

    const shouldFollowCourier = [
      "ACCEPTED",
      "PICKED_UP",
      "IN_TRANSIT",
      "ARRIVING",
      "ARRIVED",
      "OUT_FOR_DELIVERY",
    ].includes(order?.status);

    if (!shouldFollowCourier) {
      return;
    }

    //-----------------------------------------
    // Read CourierLiveLocation
    //-----------------------------------------

    const courierLat = toCoordinate(courierLiveLocation?.latitude);
    const courierLng = toCoordinate(courierLiveLocation?.longitude);
    const courierHeading = toCoordinate(courierLiveLocation?.heading);

    //-----------------------------------------
    // Validate Location
    //-----------------------------------------

    if (!isValidCoordinate(courierLat, courierLng)) {
      return;
    }

    //-----------------------------------------
    // Ensure Map Exists
    //-----------------------------------------

    if (!isMapReady || !mapRef.current) {
      return;
    }

    //-----------------------------------------
    // Animate Driver Card
    //-----------------------------------------

    if (order?.status === "ACCEPTED") {
      Animated.spring(driverCardAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();

      bottomSheetRef.current?.expand();
    }

    //-----------------------------------------
    // Build Camera Configuration
    //-----------------------------------------

    const camera = {
      center: {
        latitude: courierLat,
        longitude: courierLng,
      },
      zoom: 16,
    };

    //-----------------------------------------
    // Move Camera To Courier
    //-----------------------------------------

    mapRef.current.animateCamera(camera, {
      duration: 900,
    });
  }, [
    order?.status,
    courierLiveLocation?.latitude,
    courierLiveLocation?.longitude,
    driverCardAnim,
    isMapReady,
  ]);

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

    const timer = setTimeout(async () => {
      try {
        const latestOrder = await DataStore.query(Order, order.id);

        if (!latestOrder) {
          return;
        }

        await DataStore.save(
          Order.copyOf(latestOrder, (updated) => {
            updated.hasNewOffer = false;
          }),
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
    }, 1500);

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
  // COURIER LIVE COORDINATES
  // =================================================
  //
  // IMPORTANT:
  //
  // There is NO courier?.lat / courier?.lng here.
  //
  // Everything comes from CourierLiveLocation.
  // =================================================

  const courierLatitude = toCoordinate(courierLiveLocation?.latitude);

  const courierLongitude = toCoordinate(courierLiveLocation?.longitude);

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
        Order.copyOf(latestOrder, (updated) => {
          updated.status = "ACCEPTED";

          updated.totalPrice = offer.amount;

          updated.acceptedOfferID = offer.id;

          updated.assignedCourierId = offer.courierID;

          updated.hasNewOffer = false;
        }),
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
          Offer.copyOf(latestOffer, (updated) => {
            updated.status = "ACCEPTED";
          }),
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
        Order.copyOf(latestOrder, (updated) => {
          updated.hasNewOffer = true;

          updated.lastOfferAt = new Date().toISOString();

          updated.lastOfferSenderType = "USER";
        }),
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
          onMapReady={() => setIsMapReady(true)}
          initialRegion={{
            latitude: origin.latitude,
            longitude: origin.longitude,

            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation={false}
          followsUserLocation={false}
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
              ASSIGNED COURIER MARKER
          ================================= */}
          {/*
             The courier marker is now driven by
             CourierLiveLocation.

             The courier profile image still comes
             from the Courier record.
          ================================= */}

          {hasValidCourierLocation && (
            <Marker.Animated
              coordinate={{
                latitude: courierAnim.latitude,
                longitude: courierAnim.longitude,
              }}
              anchor={{
                x: 0.5,
                y: 0.5,
              }}
              flat={true}
              tracksViewChanges={true}
            >
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: `${toCoordinate(courierLiveLocation?.heading) || 0}deg`,
                    },
                  ],
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
              </Animated.View>
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
