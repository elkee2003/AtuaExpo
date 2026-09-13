import { TRANSPORT_TYPES } from "@/constants/transportTypes";
import { useLocationContext } from "@/providers/LocationProvider";
import { Courier, CourierLiveLocation } from "@/src/models";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { DataStore } from "aws-amplify/datastore";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  useWindowDimensions,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { GOOGLE_API_KEY } from "../../../keys";
import styles from "./styles";

/**
 * A live-location record older than this is considered stale.
 *
 * This prevents a courier who stopped sending GPS updates from
 * remaining visible at an old/frozen location.
 */
const LOCATION_STALE_AFTER_MS = 3 * 60 * 1000;

const ResultMap = () => {
  const { width, height } = useWindowDimensions();

  /**
   * Customer's current device location.
   *
   * This is only used for the "showsUserLocation" map feature
   * and does not control the courier positions.
   */
  const [location, setLocation] = useState(null);

  /**
   * Courier profile records.
   *
   * These contain things such as:
   * - id
   * - isOnline
   * - isApproved
   * - isBlocked
   * - transportationType
   */
  const [couriers, setCouriers] = useState([]);

  /**
   * Current GPS records for couriers.
   *
   * These contain:
   * - latitude
   * - longitude
   * - heading
   * - speed
   * - accuracy
   * - isTracking
   * - lastSeenAt
   */
  const [liveLocations, setLiveLocations] = useState([]);

  /**
   * Error state for the customer's location.
   */
  const [errorMsg, setErrorMsg] = useState(null);

  const {
    originAddress,
    destinationAddress,
    setTotalMins,
    setTotalKm,
    setIsRouteReady,
  } = useLocationContext();

  /**
   * Origin coordinate.
   *
   * The fallback values are retained from your original code.
   */
  const originLoc = {
    latitude: originAddress?.details?.geometry?.location?.lat || 4.8089763,

    longitude: originAddress?.details?.geometry?.location?.lng || 7.0220555,
  };

  /**
   * Destination coordinate.
   *
   * The fallback values are retained from your original code.
   */
  const destinationLoc = {
    latitude: destinationAddress?.details?.geometry?.location?.lat || 6.5243793,

    longitude:
      destinationAddress?.details?.geometry?.location?.lng || 3.3792057,
  };

  /**
   * Select the correct courier marker image based on
   * transportation type.
   */
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

  /**
   * Called when Google Maps has finished calculating the route.
   *
   * We preserve your existing route calculation logic.
   */
  const onDirectionReady = (result) => {
    const distance = result.distance;
    const duration = result.duration;

    setTotalKm(distance.toFixed(2));
    setTotalMins(duration.toFixed(0));
    setIsRouteReady(true);
  };

  /**
   * Reset route state whenever the user changes the
   * origin or destination.
   */
  useEffect(() => {
    setIsRouteReady(false);
  }, [originAddress, destinationAddress, setIsRouteReady]);

  /**
   * ============================================================
   * CUSTOMER LOCATION
   * ============================================================
   *
   * We only need foreground location for the customer.
   */
  useEffect(() => {
    let isMounted = true;

    const getCustomerLocation = async () => {
      try {
        setErrorMsg(null);

        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          if (isMounted) {
            setErrorMsg("Permission to access location was denied");
          }

          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const latitude = currentLocation?.coords?.latitude;
        const longitude = currentLocation?.coords?.longitude;

        if (typeof latitude !== "number" || typeof longitude !== "number") {
          if (isMounted) {
            setErrorMsg("Unable to determine your current location");
          }

          return;
        }

        if (isMounted) {
          setLocation({
            latitude,
            longitude,
          });
        }
      } catch (error) {
        console.error("[ResultMap] Error fetching customer location:", error);

        if (isMounted) {
          setErrorMsg("Failed to fetch location");
        }
      }
    };

    getCustomerLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * ============================================================
   * COURIER PROFILES
   * ============================================================
   *
   * Courier is used for availability/profile information.
   *
   * We intentionally do NOT use courier.lat/courier.lng here.
   * Live GPS coordinates come from CourierLiveLocation.
   */
  useEffect(() => {
    let isMounted = true;

    const fetchCouriers = async () => {
      try {
        const onlineCouriers = await DataStore.query(Courier, (c) =>
          c.isOnline.eq(true),
        );

        if (!isMounted) {
          return;
        }

        /**
         * Only keep couriers that are:
         *
         * - online
         * - approved
         * - not blocked
         */
        const availableCouriers = onlineCouriers.filter(
          (courier) =>
            courier?.isOnline === true &&
            courier?.isApproved === true &&
            courier?.isBlocked !== true,
        );

        setCouriers(availableCouriers);
      } catch (error) {
        console.error("[ResultMap] Error fetching couriers:", error);
      }
    };

    fetchCouriers();

    /**
     * Observe Courier changes.
     *
     * This catches:
     * - courier becoming online/offline
     * - courier becoming approved/unapproved
     * - courier being blocked
     * - transportation type changes
     * - courier deletion/creation
     */
    const subscription = DataStore.observe(Courier).subscribe({
      next: ({ opType, element }) => {
        if (!element) {
          return;
        }

        setCouriers((existingCouriers) => {
          /**
           * INSERT
           */
          if (opType === "INSERT") {
            const isAvailable =
              element.isOnline === true &&
              element.isApproved === true &&
              element.isBlocked !== true;

            if (!isAvailable) {
              return existingCouriers;
            }

            const alreadyExists = existingCouriers.some(
              (courier) => courier.id === element.id,
            );

            if (alreadyExists) {
              return existingCouriers;
            }

            return [...existingCouriers, element];
          }

          /**
           * UPDATE
           */
          if (opType === "UPDATE") {
            const isAvailable =
              element.isOnline === true &&
              element.isApproved === true &&
              element.isBlocked !== true;

            const exists = existingCouriers.some(
              (courier) => courier.id === element.id,
            );

            /**
             * Courier is no longer available.
             * Remove them from the map's available courier list.
             */
            if (!isAvailable) {
              return existingCouriers.filter(
                (courier) => courier.id !== element.id,
              );
            }

            /**
             * Courier remains available.
             * Update the existing courier record.
             */
            if (exists) {
              return existingCouriers.map((courier) =>
                courier.id === element.id ? element : courier,
              );
            }

            /**
             * Courier became available and wasn't previously
             * in our state.
             */
            return [...existingCouriers, element];
          }

          /**
           * DELETE
           */
          if (opType === "DELETE") {
            return existingCouriers.filter(
              (courier) => courier.id !== element.id,
            );
          }

          return existingCouriers;
        });
      },

      error: (error) => {
        console.error("[ResultMap] Courier observer error:", error);
      },
    });

    return () => {
      subscription.unsubscribe();
      isMounted = false;
    };
  }, []);

  /**
   * ============================================================
   * COURIER LIVE LOCATIONS
   * ============================================================
   *
   * This is the important part.
   *
   * CourierLiveLocation is now the SOURCE OF TRUTH for the
   * courier's current latitude/longitude.
   */
  useEffect(() => {
    let isMounted = true;

    const fetchLiveLocations = async () => {
      try {
        const locations = await DataStore.query(CourierLiveLocation);

        if (!isMounted) {
          return;
        }

        setLiveLocations(locations);
      } catch (error) {
        console.error(
          "[ResultMap] Error fetching courier live locations:",
          error,
        );
      }
    };

    fetchLiveLocations();

    /**
     * Observe real-time CourierLiveLocation changes.
     *
     * Whenever the courier background task saves a new GPS
     * position, this observer receives the updated record.
     */
    const subscription = DataStore.observe(CourierLiveLocation).subscribe({
      next: ({ opType, element }) => {
        if (!element) {
          return;
        }

        setLiveLocations((existingLocations) => {
          /**
           * INSERT
           */
          if (opType === "INSERT") {
            const alreadyExists = existingLocations.some(
              (locationItem) => locationItem.id === element.id,
            );

            if (alreadyExists) {
              return existingLocations;
            }

            return [...existingLocations, element];
          }

          /**
           * UPDATE
           */
          if (opType === "UPDATE") {
            const exists = existingLocations.some(
              (locationItem) => locationItem.id === element.id,
            );

            if (exists) {
              return existingLocations.map((locationItem) =>
                locationItem.id === element.id ? element : locationItem,
              );
            }

            /**
             * This handles the case where the component did
             * not previously have the location record locally.
             */
            return [...existingLocations, element];
          }

          /**
           * DELETE
           */
          if (opType === "DELETE") {
            return existingLocations.filter(
              (locationItem) => locationItem.id !== element.id,
            );
          }

          return existingLocations;
        });
      },

      error: (error) => {
        console.error("[ResultMap] CourierLiveLocation observer error:", error);
      },
    });

    return () => {
      subscription.unsubscribe();
      isMounted = false;
    };
  }, []);

  /**
   * ============================================================
   * PREPARE COURIERS FOR THE MAP
   * ============================================================
   *
   * Join Courier + CourierLiveLocation.
   *
   * Courier:
   *   -> identity
   *   -> transportationType
   *   -> availability
   *
   * CourierLiveLocation:
   *   -> latitude
   *   -> longitude
   *   -> heading
   *   -> lastSeenAt
   *   -> isTracking
   */
  const mapCouriers = useMemo(() => {
    const now = Date.now();

    return liveLocations
      .map((liveLocation) => {
        if (!liveLocation) {
          return null;
        }

        /**
         * Make sure this courier actually belongs to our
         * currently available courier list.
         */
        const courier = couriers.find(
          (item) => item.id === liveLocation.courierID,
        );

        if (!courier) {
          return null;
        }

        /**
         * The courier's GPS tracking must be active.
         */
        if (liveLocation.isTracking !== true) {
          return null;
        }

        /**
         * Validate latitude.
         */
        if (
          typeof liveLocation.latitude !== "number" ||
          !Number.isFinite(liveLocation.latitude)
        ) {
          return null;
        }

        /**
         * Validate longitude.
         */
        if (
          typeof liveLocation.longitude !== "number" ||
          !Number.isFinite(liveLocation.longitude)
        ) {
          return null;
        }

        /**
         * Ignore stale GPS locations.
         */
        if (liveLocation.lastSeenAt) {
          const timestamp = new Date(liveLocation.lastSeenAt).getTime();

          if (!Number.isNaN(timestamp)) {
            const age = now - timestamp;

            if (age > LOCATION_STALE_AFTER_MS) {
              return null;
            }
          }
        }

        return {
          courier,
          liveLocation,
        };
      })
      .filter(Boolean);
  }, [couriers, liveLocations]);

  /**
   * Don't render the map until we have determined the customer's
   * current location.
   */
  if (!location) {
    return <ActivityIndicator style={{ marginTop: 30 }} size="large" />;
  }

  return (
    <View style={styles.container}>
      <MapView
        style={{
          width,
          height: height - 100,
        }}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          /**
           * The map begins at the selected origin.
           */
          latitude:
            originAddress?.details?.geometry?.location?.lat || 4.8089763,

          longitude:
            originAddress?.details?.geometry?.location?.lng || 7.0220555,

          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        showsUserLocation
      >
        {/* ======================================================
            ROUTE
            ====================================================== */}

        <MapViewDirections
          origin={originLoc}
          destination={destinationLoc}
          apikey={GOOGLE_API_KEY}
          timePrecision="now"
          strokeWidth={3}
          strokeColor="red"
          onReady={onDirectionReady}
        />

        {/* ======================================================
            ORIGIN MARKER
            ====================================================== */}

        <Marker
          title="Origin"
          description={
            originAddress?.data?.description ||
            "Origin description not available"
          }
          coordinate={originLoc}
        >
          <FontAwesome6 name="location-dot" size={35} color="green" />
        </Marker>

        {/* ======================================================
            DESTINATION MARKER
            ====================================================== */}

        <Marker
          title="Destination"
          description={
            destinationAddress?.data?.description ||
            "Destination description not available"
          }
          coordinate={destinationLoc}
        >
          <FontAwesome6 name="location-dot" size={35} color="darkgreen" />
        </Marker>

        {/* ======================================================
            LIVE COURIER MARKERS
            ====================================================== */}

        {mapCouriers.map(({ courier, liveLocation }) => (
          <Marker
            key={courier.id}
            coordinate={{
              latitude: liveLocation.latitude,
              longitude: liveLocation.longitude,
            }}
            anchor={{
              x: 0.5,
              y: 1,
            }}
            /**
             * Rotate the vehicle marker according to its
             * current direction of travel.
             *
             * If heading isn't available, keep it upright.
             */
            rotation={
              typeof liveLocation.heading === "number"
                ? liveLocation.heading
                : 0
            }
            tracksViewChanges={false}
          >
            <Image
              style={styles.markerImage}
              source={getImage(courier.transportationType)}
            />
          </Marker>
        ))}
      </MapView>
    </View>
  );
};

export default ResultMap;
