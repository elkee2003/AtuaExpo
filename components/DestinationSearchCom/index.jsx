import { useLocationContext } from "@/providers/LocationProvider";
import AntDesign from "@expo/vector-icons/AntDesign";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { GOOGLE_API_KEY } from "../../keys";
import PlaceRow from "./placeRow";
import styles from "./styles";

const DestinationSearchComponent = () => {
  const { lastDestination, address } = useLocalSearchParams();

  const {
    setOriginAddress,
    setDestinationAddress,
    originLat,
    setOriginLat,
    originLng,
    setOriginLng,
    destinationLat,
    setDestinationLat,
    destinationLng,
    setDestinationLng,
    originState,
    setOriginState,
    destinationState,
    setDestinationState,
    setIsInterState,
  } = useLocationContext();

  const originAutocompleteRef = useRef(null);
  const destinationAutocompleteRef = useRef(null);

  const [originLoading, setOriginLoading] = useState(false);
  const [destinationLoading, setDestinationLoading] = useState(false);

  /* ------------------ HELPERS ------------------ */

  const extractCoordinates = (details) => {
    const location = details?.geometry?.location;

    if (!location) return null;

    return {
      lat: location.lat,
      lng: location.lng,
    };
  };

  const extractState = (details) => {
    if (!details?.address_components) return null;

    const stateComponent = details.address_components.find((component) =>
      component.types.includes("administrative_area_level_1"),
    );

    return stateComponent?.long_name || null;
  };

  const saveLastDestination = async (destination) => {
    try {
      await AsyncStorage.setItem("lastDestination", destination);
    } catch (error) {
      console.log(error);
    }
  };

  const clearOriginInput = () => {
    originAutocompleteRef.current?.clear();
    setOriginAddress(null);
  };

  const clearDestinationInput = () => {
    destinationAutocompleteRef.current?.clear();
    setDestinationAddress(null);
  };

  /* ------------------ NAVIGATION ------------------ */

  useEffect(() => {
    if (originLat && destinationLat) {
      router.push("/screens/searchresults");
    }
  }, [originLat, destinationLat, originState, destinationState]);

  /* ------------------ INTERSTATE DETECTION ------------------ */

  useEffect(() => {
    if (originState && destinationState) {
      setIsInterState(originState !== destinationState);
    }
  }, [originState, destinationState]);

  /* ------------------ SWAP ORIGIN DESTINATION ------------------ */
  // I am commenting this out because, despite it switching successfully, it doesn't save lat and lng when switching
  // const swapLocations = () => {
  //   const originText = originAutocompleteRef.current?.getAddressText?.() || "";
  //   const destText =
  //     destinationAutocompleteRef.current?.getAddressText?.() || "";

  //   originAutocompleteRef.current?.setAddressText(destText);
  //   destinationAutocompleteRef.current?.setAddressText(originText);
  // };

  /* ------------------ PREPOPULATE PICKUP LOCATION ------------------ */

  const populateCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        console.log("Permission denied");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;

      setOriginLat(latitude);
      setOriginLng(longitude);

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}`,
      );

      const data = await response.json();

      const result = data.results?.[0];
      const address = result?.formatted_address;

      if (address && originAutocompleteRef.current) {
        originAutocompleteRef.current.setAddressText(address);

        const details = {
          geometry: {
            location: {
              lat: latitude,
              lng: longitude,
            },
          },
          address_components: result?.address_components,
        };

        setOriginAddress({
          data: { description: address },
          details,
        });

        // 🔥 FIX: Extract state just like manual selection
        const state = extractState(details);
        setOriginState(state);
      }
    } catch (error) {
      console.log("Location error", error);
    }
  };

  useEffect(() => {
    populateCurrentLocation();
  }, []);

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pickup & delivery locations</Text>
      </View>

      {/* SEARCH CARD */}
      <View style={styles.searchCard}>
        {/* ORIGIN INPUT */}

        <GooglePlacesAutocomplete
          ref={originAutocompleteRef}
          placeholder="Pickup location"
          fetchDetails
          debounce={400}
          enablePoweredByContainer={false}
          suppressDefaultStyles
          query={{
            key: GOOGLE_API_KEY,
            language: "en",
            components: "country:ng",
          }}
          onPress={(data, details = null) => {
            setOriginAddress({ data, details });

            const coords = extractCoordinates(details);

            if (coords) {
              setOriginLat(coords.lat);
              setOriginLng(coords.lng);
            }

            const state = extractState(details);
            setOriginState(state);
          }}
          renderRow={(data) => <PlaceRow data={data} />}
          styles={{
            textInput: styles.textInput,
            container: styles.inputContainer,
            listView: styles.listView,
          }}
          renderRightButton={() => (
            <View style={styles.rightButtonContainer}>
              {originLoading && <ActivityIndicator size="small" />}
              <AntDesign
                name="close-circle"
                size={18}
                onPress={clearOriginInput}
              />
            </View>
          )}
          isSearching={(loading) => setOriginLoading(loading)}
        />

        {/* SWAP BUTTON */}
        {/* I am commenting this out because, despite it switching successfully, it doesn't save lat and lng when switching. I also commented out the function for it */}
        {/* <TouchableOpacity style={styles.swapButton} onPress={swapLocations}>
          <MaterialIcons name="swap-vert" size={22} color="#444" />
        </TouchableOpacity> */}

        {/* DESTINATION INPUT */}

        <GooglePlacesAutocomplete
          ref={destinationAutocompleteRef}
          placeholder="Destination"
          fetchDetails
          debounce={400}
          enablePoweredByContainer={false}
          suppressDefaultStyles
          query={{
            key: GOOGLE_API_KEY,
            language: "en",
            components: "country:ng",
          }}
          onPress={(data, details = null) => {
            setDestinationAddress({ data, details });

            const coords = extractCoordinates(details);

            if (coords) {
              setDestinationLat(coords.lat);
              setDestinationLng(coords.lng);
            }

            const state = extractState(details);
            setDestinationState(state);

            saveLastDestination(data.description || details?.formatted_address);
          }}
          renderRow={(data) => <PlaceRow data={data} />}
          styles={{
            textInput: styles.textInput,
            container: styles.inputContainer,
          }}
          renderRightButton={() => (
            <View style={styles.rightButtonContainer}>
              {destinationLoading && <ActivityIndicator size="small" />}
              <AntDesign
                name="close-circle"
                size={18}
                onPress={clearDestinationInput}
              />
            </View>
          )}
          isSearching={(loading) => setDestinationLoading(loading)}
        />
      </View>
    </View>
  );
};

export default DestinationSearchComponent;
