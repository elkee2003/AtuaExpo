import { TRANSPORT_TYPES } from "@/constants/transportTypes";
import { Courier } from "@/src/models";
import { DataStore } from "aws-amplify/datastore";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  View,
  useWindowDimensions,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import styles from "./styles";

const HomeMap = () => {
  const { width, height } = useWindowDimensions();
  const [couriers, setCouriers] = useState([]);
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

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

  const fetchCouriers = async () => {
    try {
      const onlineCouriers = await DataStore.query(Courier, (c) =>
        c.isOnline.eq(true),
      );
      setCouriers(onlineCouriers);
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  useEffect(() => {
    fetchCouriers();

    const subscription = DataStore.observe(Courier).subscribe((msg) => {
      const { opType, element } = msg;

      setCouriers((existingCouriers) => {
        if (opType === "INSERT") {
          return [...existingCouriers, element];
        }

        if (opType === "UPDATE") {
          return existingCouriers.map((c) =>
            c.id === element.id ? element : c,
          );
        }

        if (opType === "DELETE") {
          return existingCouriers.filter((c) => c.id !== element.id);
        }

        return existingCouriers;
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setErrorMsg("Permission to access location was denied");
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: location.coords?.latitude,
          longitude: location.coords?.longitude,
        });
      } catch (error) {
        console.error("Error fetching location:", error);
        setErrorMsg("Failed to fetch location");
      }
    })();
  }, []);

  if (!location || !location.latitude || !location.longitude) {
    return <ActivityIndicator style={{ marginTop: 30 }} size="large" />;
  }

  return (
    <View style={styles.container}>
      <MapView
        style={{ width, height: height - 120 }}
        provider={PROVIDER_GOOGLE}
        region={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        // initialRegion={{
        //   latitude: location.latitude,
        //   longitude: location.longitude,
        //   latitudeDelta: 0.0922,
        //   longitudeDelta: 0.0421,
        // }}
        showsUserLocation
      >
        {couriers
          .filter((courier) => courier?.lat != null && courier?.lng != null) // Filter couriers with valid coordinates
          .map((courier) => (
            <Marker
              key={courier.id}
              coordinate={{ latitude: courier?.lat, longitude: courier?.lng }}
              anchor={{ x: 0.5, y: 1 }}
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
