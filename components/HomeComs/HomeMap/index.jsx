import { TRANSPORT_TYPES } from "@/constants/transportTypes";
import { Courier, CourierLiveLocation } from "@/src/models";
import { DataStore } from "aws-amplify/datastore";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  View,
  useWindowDimensions,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import styles from "./styles";

/**
 * How old a live-location record can be before we consider it stale.
 *
 * Example:
 * If the courier's last GPS update was more than 3 minutes ago,
 * we don't show that courier on the HomeMap.
 *
 * This prevents the map from showing couriers who have gone offline
 * but whose last coordinates are still stored in the database.
 */
const LOCATION_STALE_AFTER_MS = 3 * 60 * 1000;

/**
 * HomeMap
 *
 * Responsibilities:
 * 1. Get the customer's current location.
 * 2. Get online/approved/active couriers.
 * 3. Get their CourierLiveLocation records.
 * 4. Combine Courier + CourierLiveLocation.
 * 5. Display courier markers on the map.
 * 6. React to real-time DataStore updates.
 */
const HomeMap = () => {
  const { width, height } = useWindowDimensions();

  // Customer's current location.
  const [location, setLocation] = useState(null);

  // Courier profile records.
  const [couriers, setCouriers] = useState([]);

  // Current live GPS records.
  const [liveLocations, setLiveLocations] = useState([]);

  // Loading/error state.
  const [loadingCouriers, setLoadingCouriers] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  /**
   * Returns the correct marker image based on the courier's
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
   * Get the customer's current location.
   *
   * This uses foreground permission because this is the customer's
   * HomeMap and we only need their current position while the app
   * is being used.
   */
  useEffect(() => {
    let isMounted = true;

    const getUserLocation = async () => {
      try {
        setErrorMsg(null);

        // Request foreground location permission.
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          if (isMounted) {
            setErrorMsg("Permission to access location was denied.");
          }

          return;
        }

        // Get customer's current GPS position.
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const latitude = currentLocation?.coords?.latitude;
        const longitude = currentLocation?.coords?.longitude;

        // Make sure the GPS coordinates are valid numbers.
        if (typeof latitude !== "number" || typeof longitude !== "number") {
          if (isMounted) {
            setErrorMsg("Unable to determine your current location.");
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
        console.error("[HomeMap] Error fetching user location:", error);

        if (isMounted) {
          setErrorMsg("Failed to fetch your current location.");
        }
      }
    };

    getUserLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Fetch online/approved couriers.
   *
   * Courier contains profile/business information such as:
   * - transportationType
   * - isOnline
   * - isApproved
   * - isBlocked
   *
   * CourierLiveLocation contains the actual live coordinates.
   */
  useEffect(() => {
    let isMounted = true;

    const fetchCouriers = async () => {
      try {
        setLoadingCouriers(true);

        const onlineCouriers = await DataStore.query(Courier, (c) =>
          c.isOnline.eq(true),
        );

        if (!isMounted) {
          return;
        }

        /**
         * Only allow couriers who are:
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
        console.error("[HomeMap] Error fetching couriers:", error);

        if (isMounted) {
          setErrorMsg("Failed to load available couriers.");
        }
      } finally {
        if (isMounted) {
          setLoadingCouriers(false);
        }
      }
    };

    fetchCouriers();

    /**
     * Observe Courier changes.
     *
     * This allows the map to immediately react when:
     * - a courier comes online
     * - a courier goes offline
     * - a courier is approved
     * - a courier is blocked
     */
    const subscription = DataStore.observe(Courier).subscribe({
      next: ({ opType, element }) => {
        if (!element) {
          return;
        }

        setCouriers((existingCouriers) => {
          // Courier created.
          if (opType === "INSERT") {
            if (
              element.isOnline === true &&
              element.isApproved === true &&
              element.isBlocked !== true
            ) {
              // Prevent duplicate entries.
              const alreadyExists = existingCouriers.some(
                (courier) => courier.id === element.id,
              );

              if (alreadyExists) {
                return existingCouriers;
              }

              return [...existingCouriers, element];
            }

            return existingCouriers;
          }

          // Courier updated.
          if (opType === "UPDATE") {
            const isAvailable =
              element.isOnline === true &&
              element.isApproved === true &&
              element.isBlocked !== true;

            const exists = existingCouriers.some(
              (courier) => courier.id === element.id,
            );

            // If the courier is no longer available,
            // remove them from the map.
            if (!isAvailable) {
              return existingCouriers.filter(
                (courier) => courier.id !== element.id,
              );
            }

            // If available and already in the list,
            // update their profile.
            if (exists) {
              return existingCouriers.map((courier) =>
                courier.id === element.id ? element : courier,
              );
            }

            // If they became available but weren't previously
            // present, add them.
            return [...existingCouriers, element];
          }

          // Courier deleted.
          if (opType === "DELETE") {
            return existingCouriers.filter(
              (courier) => courier.id !== element.id,
            );
          }

          return existingCouriers;
        });
      },

      error: (error) => {
        console.error("[HomeMap] Courier observer error:", error);
      },
    });

    return () => {
      subscription.unsubscribe();
      isMounted = false;
    };
  }, []);

  /**
   * Fetch the current live-location records.
   *
   * IMPORTANT:
   * We do NOT use Courier.lat / Courier.lng as the primary
   * map coordinates anymore.
   *
   * CourierLiveLocation is our live GPS source.
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
        console.error("[HomeMap] Error fetching live locations:", error);
      }
    };

    fetchLiveLocations();

    /**
     * Observe changes to CourierLiveLocation.
     *
     * When a courier moves and the background task updates
     * CourierLiveLocation, this observer receives the change
     * and the marker can move automatically.
     */
    const subscription = DataStore.observe(CourierLiveLocation).subscribe({
      next: ({ opType, element }) => {
        if (!element) {
          return;
        }

        setLiveLocations((existingLocations) => {
          // New live-location record.
          if (opType === "INSERT") {
            const alreadyExists = existingLocations.some(
              (locationItem) => locationItem.id === element.id,
            );

            if (alreadyExists) {
              return existingLocations;
            }

            return [...existingLocations, element];
          }

          // Live-location updated.
          if (opType === "UPDATE") {
            const exists = existingLocations.some(
              (locationItem) => locationItem.id === element.id,
            );

            if (exists) {
              return existingLocations.map((locationItem) =>
                locationItem.id === element.id ? element : locationItem,
              );
            }

            return [...existingLocations, element];
          }

          // Live-location deleted.
          if (opType === "DELETE") {
            return existingLocations.filter(
              (locationItem) => locationItem.id !== element.id,
            );
          }

          return existingLocations;
        });
      },

      error: (error) => {
        console.error("[HomeMap] CourierLiveLocation observer error:", error);
      },
    });

    return () => {
      subscription.unsubscribe();
      isMounted = false;
    };
  }, []);

  /**
   * Combine:
   *
   * Courier
   * +
   * CourierLiveLocation
   *
   * into the actual objects needed by the map.
   *
   * We use useMemo so this is only recalculated when either
   * couriers or liveLocations changes.
   */
  const mapCouriers = useMemo(() => {
    const now = Date.now();

    return liveLocations
      .map((liveLocation) => {
        if (!liveLocation) {
          return null;
        }

        /**
         * Find the Courier associated with this live location.
         *
         * Schema relationship:
         *
         * CourierLiveLocation.courierID
         *            ↓
         * Courier.id
         */
        const courier = couriers.find(
          (item) => item.id === liveLocation.courierID,
        );

        // We cannot display the marker without the courier record
        // because we need transportationType for the image.
        if (!courier) {
          return null;
        }

        // Make sure the live location is currently tracking.
        if (liveLocation.isTracking !== true) {
          return null;
        }

        // Validate latitude.
        if (
          typeof liveLocation.latitude !== "number" ||
          !Number.isFinite(liveLocation.latitude)
        ) {
          return null;
        }

        // Validate longitude.
        if (
          typeof liveLocation.longitude !== "number" ||
          !Number.isFinite(liveLocation.longitude)
        ) {
          return null;
        }

        /**
         * Check whether the GPS record is stale.
         *
         * lastSeenAt is required in your schema.
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
   * Loading state.
   *
   * We only need to wait for the user's location before rendering
   * the map. Courier data can continue loading while the map is up.
   */
  if (!location) {
    return (
      <View
        style={[
          styles.container,
          {
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" />

        {errorMsg ? null : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={{
          width,
          height: height - 120,
        }}
        provider={PROVIDER_GOOGLE}
        /**
         * Keep the map centered around the customer's location.
         */
        region={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        /**
         * Display the user's own blue location marker.
         */
        showsUserLocation
        /**
         * Optional useful map settings.
         */
        showsMyLocationButton
        showsCompass
        loadingEnabled
      >
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
             * Rotate the courier marker according to their
             * current heading when heading is available.
             */
            rotation={
              typeof liveLocation.heading === "number"
                ? liveLocation.heading
                : 0
            }
            /**
             * Prevent unnecessary callouts unless you later
             * decide to add courier information to the marker.
             */
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

export default HomeMap;
