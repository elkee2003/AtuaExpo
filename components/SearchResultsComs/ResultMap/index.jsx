import { useLocationContext } from "@/providers/LocationProvider";
import { Courier } from "@/src/models";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { DataStore } from "aws-amplify/datastore";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  useWindowDimensions,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { GOOGLE_API_KEY } from "../../../keys";
import styles from "./styles";

const ResultMap = () => {
  const { width, height } = useWindowDimensions();
  const [couriers, setCouriers] = useState([]);
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const { originAddress, destinationAddress, setTotalMins, setTotalKm } =
    useLocationContext();

  const originLoc = {
    latitude: originAddress?.details?.geometry?.location?.lat || 4.8089763,
    longitude: originAddress?.details?.geometry?.location?.lng || 7.0220555,
  };

  const destinationLoc = {
    latitude: destinationAddress?.details?.geometry?.location?.lat || 6.5243793,
    longitude:
      destinationAddress?.details?.geometry?.location?.lng || 3.3792057,
  };

  const getImage = (type) => {
    if (type === "Micro X") {
      return require("../../../assets/atuaImages/Bicycle.png");
    }
    if (type === "Moto X") {
      return require("../../../assets/atuaImages/Bike.jpg");
    }
    if (type === "Maxi Batch") {
      return require("../../../assets/atuaImages/top-UberXL.png");
    }
    if (type === "Maxi") {
      return require("../../../assets/atuaImages/Deliverybicycle.png");
    }
    return require("../../../assets/atuaImages/Walk.png");
  };

  const onDirectionReady = (result) => {
    const distance = result.distance;
    const duration = result.duration;

    setTotalKm(distance.toFixed(2));
    setTotalMins(duration.toFixed(0));
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

    const subscription = DataStore.observe(Courier).subscribe(({ opType }) => {
      if (opType === "INSERT" || opType === "UPDATE" || opType === "DELETE") {
        fetchCouriers();
      }
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
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
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
        style={{ width, height: height - 100 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          // latitude: 4.8089763,
          // longitude:  7.0220555,
          // latitude: location.latitude,
          // longitude: location.longitude,
          latitude: originAddress?.details.geometry.location.lat || 4.8089763,
          longitude: originAddress?.details.geometry.location.lng || 7.0220555,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        showsUserLocation
      >
        <MapViewDirections
          origin={originLoc}
          destination={destinationLoc}
          apikey={GOOGLE_API_KEY}
          timePrecision="now"
          strokeWidth={3}
          strokeColor="red"
          onReady={onDirectionReady}
        />

        {/* Origin Marker */}
        <Marker
          title={"Origin"}
          description={
            originAddress?.data?.description ||
            "Origin description not available"
          }
          coordinate={originLoc}
        >
          <FontAwesome6 name="location-dot" size={35} color="green" />
        </Marker>

        {/* Destination Marker */}
        <Marker
          title={"Destination"}
          description={
            destinationAddress?.data?.description ||
            "Destination description not available"
          }
          coordinate={destinationLoc}
        >
          <FontAwesome6 name="location-dot" size={35} color="darkgreen" />
        </Marker>

        {/* Courier Markers */}
        {couriers
          .filter((courier) => courier?.lat != null && courier?.lng != null) // Filter couriers with valid coordinates
          .map((courier) => (
            <Marker
              key={courier.id}
              coordinate={{ latitude: courier?.lat, longitude: courier?.lng }}
            >
              <Image
                style={{ width: 50, height: 70, resizeMode: "contain" }}
                source={getImage(courier.transportationType)}
              />
            </Marker>
          ))}
      </MapView>
    </View>
  );
};

export default ResultMap;
