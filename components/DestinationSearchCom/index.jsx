import { useLocationContext } from "@/providers/LocationProvider";
import AntDesign from "@expo/vector-icons/AntDesign";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { GOOGLE_API_KEY } from "../../keys";
import PlaceRow from "./placeRow";
import styles from "./styles";

// Remember to prepopulate the originAddress with user's location

// const homePlace = {
//     description: 'Home',
//     geometry: { location: { lat, lng} },
// };

const workPlace = {
  description: "Work",
  geometry: { location: { lat: 48.8496818, lng: 2.2940881 } },
};

const DestinationSearchComponent = () => {
  // const homePlace = {
  //     description: 'Home',
  //     geometry: { location: { lat, lng} },
  // };

  // const {lat,lng} = useProfileContext()

  const { lastDestination, address } = useLocalSearchParams();

  const {
    originAddress,
    destinationAddress,
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
    isInterState,
    setIsInterState,
  } = useLocationContext();

  const [loading, setLoading] = useState(false); // Loading state

  const originAutocompleteRef = useRef(null);
  const destinationAutocompleteRef = useRef(null);

  const clearOriginInput = () => {
    if (originAutocompleteRef.current) {
      originAutocompleteRef.current.clear(); // Clear the input field
    }
    setOriginAddress(null); // Clear originAddress state
  };

  const clearDestinationInput = () => {
    if (destinationAutocompleteRef.current) {
      destinationAutocompleteRef.current.clear(); // Clear the input field
    }
    setDestinationAddress(null); // Clear destinationAddress state
  };

  // Function to save last destination
  const saveLastDestination = async (destination) => {
    try {
      await AsyncStorage.setItem("lastDestination", destination);
    } catch (error) {
      console.error("Failed to save the last destination:", error);
    }
  };

  // Function to extract state:
  const extractState = (details) => {
    if (!details?.address_components) return null;

    const stateComponent = details.address_components.find((component) =>
      component.types.includes("administrative_area_level_1"),
    );

    return stateComponent?.long_name || null;
  };

  useEffect(() => {
    if (originAddress && destinationAddress) {
      router.push({
        pathname: "/screens/searchresults",
        // params: { originAddress, destinationAddress },
      });
    }
  }, [originAddress, destinationAddress]);

  // Pre-populate the "From" field with lastDestination if it exists
  useEffect(() => {
    if (lastDestination && originAutocompleteRef.current) {
      originAutocompleteRef.current.setAddressText(lastDestination); // Prepopulate the input

      // Simulate a selection by manually triggering setOriginAddress
      setOriginAddress({
        data: { description: lastDestination },
        details: null, // Add necessary details if you have them
      });
    }
  }, [lastDestination]);

  // Pre-populate the "From" field with home address if it exists
  useEffect(() => {
    if (address && originAutocompleteRef.current) {
      originAutocompleteRef.current.setAddressText(address); // Prepopulate the input

      // Simulate a selection by manually triggering setOriginAddress
      setOriginAddress({
        data: { description: address },
        details: null, // Add necessary details if you have them
      });
    }
  }, [address]);

  // useEffect to check if it is interstate
  useEffect(() => {
    if (originState && destinationState) {
      setIsInterState(originState !== destinationState);
    } else {
      setIsInterState(false);
    }
  }, [originState, destinationState]);

  return (
    <View style={styles.container}>
      {/* From? */}
      <GooglePlacesAutocomplete
        key="origin-autocomplete"
        debounce={300}
        placeholder="From?"
        ref={originAutocompleteRef}
        onPress={(data, details = null) => {
          setOriginAddress({ data, details });

          // Use `details` directly here instead of `originAddress.details`
          if (details && details.geometry && details.geometry.location) {
            setOriginLat(details.geometry.location.lat);
            setOriginLng(details.geometry.location.lng);

            const state = extractState(details);

            setOriginState(state);
          } else {
            console.log("No details available");
          }
        }}
        fetchDetails
        enablePoweredByContainer={false}
        suppressDefaultStyles
        query={{
          key: GOOGLE_API_KEY,
          language: "en",
          components: "country:ng",
        }}
        // currentLocation={true}
        // currentLocationLabel='Current location'
        renderRow={(data) => <PlaceRow data={data} />}
        renderDescription={(data) => data.description || data.vicinity}
        styles={{
          textInput: styles.textInput,
          container: styles.autocompleteContainer,
          listView: styles.listView,
          separator: styles.separator,
          poweredContainer: styles.gPoweredContainer,
        }}
        renderRightButton={() => (
          <AntDesign
            style={styles.topButton}
            name="close-circle"
            onPress={clearOriginInput}
          />
        )}
        onFail={(error) => console.error(error)}
        onNotFound={() => console.log("No results were found")}
        isSearching={(isSearching) => setLoading(isSearching)} // Set loading state
        // predefinedPlaces={[homePlace]}
        // currentLocation={true}
        // currentLocationLabel='Current location'
      />

      {/* To? */}
      <GooglePlacesAutocomplete
        key="destination-autocomplete"
        debounce={300}
        placeholder="To?"
        ref={destinationAutocompleteRef}
        onPress={(data, details = null) => {
          setDestinationAddress({ data, details });

          // Use `details` directly here instead of `originAddress.details`
          if (details && details.geometry && details.geometry.location) {
            setDestinationLat(details.geometry.location.lat);
            setDestinationLng(details.geometry.location.lng);

            const state = extractState(details);

            setDestinationState(state);
          } else {
            console.log("No details available");
          }
          saveLastDestination(data.description || details.formatted_address);
        }}
        fetchDetails
        enablePoweredByContainer={false}
        suppressDefaultStyles
        query={{
          key: GOOGLE_API_KEY,
          language: "en",
          components: "country:ng",
        }}
        renderRow={(data) => <PlaceRow data={data} />}
        renderDescription={(data) => data.description || data.vicinity}
        styles={{
          textInput: styles.textInput,
          container: { ...styles.autocompleteContainer, top: 55 },
          separator: styles.separator,
          poweredContainer: styles.gPoweredContainer,
        }}
        renderRightButton={() => (
          <AntDesign
            style={styles.bottomButton}
            name="close-circle"
            onPress={clearDestinationInput}
          />
        )}
        onFail={(error) => console.error(error)}
        onNotFound={() => console.log("No results were found")}
        isSearching={(isSearching) => setLoading(isSearching)} // Set loading state
        // predefinedPlaces={[homePlace]}
      />
      {/* Activity Indicator */}
      {loading && (
        <ActivityIndicator
          size="large"
          color="#0000ff"
          style={styles.activityIndicator}
        />
      )}
    </View>
  );
};

export default DestinationSearchComponent;
