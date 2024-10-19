import { View, Text, ActivityIndicator } from 'react-native'
import React, {useRef, useEffect, useState} from 'react'
import styles from './styles'
import PlaceRow from './placeRow'
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import {GOOGLE_API_KEY} from '../../keys'
import AntDesign from '@expo/vector-icons/AntDesign';
import { useLocationContext } from '@/providers/LocationProvider';
import { useProfileContext } from '@/providers/ProfileProvider';
import { router, useLocalSearchParams } from 'expo-router';

// const homePlace = {
//     description: 'Home',
//     geometry: { location: { lat, lng} },
// };

const workPlace = {
    description: 'Work',
    geometry: { location: { lat: 48.8496818, lng: 2.2940881 } },
};

const DestinationSearchComponent = () => {

    // const homePlace = {
    //     description: 'Home',
    //     geometry: { location: { lat, lng} },
    // };

    // const {lat,lng} = useProfileContext()

    const {lastDestination, address} = useLocalSearchParams()

    const {originPlace, destinationPlace, setOriginPlace, setDestinationPlace, originPlaceLat, setOriginPlaceLat, originPlaceLng, setOriginPlaceLng,  destinationPlaceLat, setDestinationPlaceLat, destinationPlaceLng, setDestinationPlaceLng} = useLocationContext()

    const [loading, setLoading] = useState(false); // Loading state

    const originAutocompleteRef = useRef(null);
    const destinationAutocompleteRef = useRef(null);

    const clearOriginInput = () => {
        if (originAutocompleteRef.current) {
          originAutocompleteRef.current.clear(); // Clear the input field
        }
        setOriginPlace(null); // Clear originPlace state
      };
    
      const clearDestinationInput = () => {
        if (destinationAutocompleteRef.current) {
          destinationAutocompleteRef.current.clear(); // Clear the input field
        }
        setDestinationPlace(null); // Clear destinationPlace state
    };

    const saveLastDestination = async (destination) => {
      try {
        await AsyncStorage.setItem('lastDestination', destination);
      } catch (error) {
        console.error('Failed to save the last destination:', error);
      }
    };


    useEffect(()=>{
      if(originPlace && destinationPlace){
        router.push({
          pathname:'/screens/orders',
          params:{originPlace, destinationPlace}
        })
      }
    },[originPlace, destinationPlace])

    // Pre-populate the "From" field with lastDestination if it exists
    useEffect(() => {
      if (lastDestination && originAutocompleteRef.current) {
        originAutocompleteRef.current.setAddressText(lastDestination); // Prepopulate the input
    
        // Simulate a selection by manually triggering setOriginPlace
        setOriginPlace({
          data: { description: lastDestination },
          details: null, // Add necessary details if you have them
        });
      }
    }, [lastDestination]);

    // Pre-populate the "From" field with home address if it exists
    useEffect(() => {
      if (address && originAutocompleteRef.current) {
        originAutocompleteRef.current.setAddressText(address); // Prepopulate the input
    
        // Simulate a selection by manually triggering setOriginPlace
        setOriginPlace({
          data: { description: address },
          details: null, // Add necessary details if you have them
        });
      }
    }, [address]);
    
  

  return (
    <View style={styles.container}>

        {/* From? */}
        <GooglePlacesAutocomplete
          placeholder='From?'
          ref={originAutocompleteRef}
          onPress={(data, details = null) => {
            setOriginPlace({data, details})
            console.log('Origin data:', data, 'Origin details:', details)
            // Use `details` directly here instead of `originPlace.details`
    if (details && details.geometry && details.geometry.location) {
      setOriginPlaceLat(details.geometry.location.lat);
      setOriginPlaceLng(details.geometry.location.lng);

      console.log('Origin lat:', details.geometry.location.lat, 'Origin lng:', details.geometry.location.lng);
    } else {
      console.log('No details available');
    }
          }}
          fetchDetails
          enablePoweredByContainer={false}
          suppressDefaultStyles
          query={{
              key: GOOGLE_API_KEY,
              language: 'en',
              components: 'country:ng',
          }}
          // currentLocation={true}
          // currentLocationLabel='Current location'
          renderRow={(data)=> <PlaceRow data={data}/>
          }
          renderDescription={(data)=> data.description || data.vicinity
          }
          styles={{
              textInput:styles.textInput,
              container: styles.autocompleteContainer,
              listView:styles.listView,
              separator:styles.separator,
              poweredContainer: styles.gPoweredContainer
          }}
          renderRightButton={() => (
            <AntDesign 
              style={styles.topButton}
              name="closecircle" 
              onPress={clearOriginInput} 
            />
          )}
          onFail={(error) => console.error(error)}
          onNotFound={() => console.log('No results were found')}
          isSearching={(isSearching) => setLoading(isSearching)} // Set loading state
          // predefinedPlaces={[homePlace]}
          // currentLocation={true}
          // currentLocationLabel='Current location'
        />

        {/* To? */}
        <GooglePlacesAutocomplete
          placeholder='To?'
          ref={destinationAutocompleteRef}
          onPress={(data, details = null) => {
            setDestinationPlace({data, details});
            console.log('destination data:', data, 'destination details:', details)
            // Use `details` directly here instead of `originPlace.details`
    if (details && details.geometry && details.geometry.location) {
      setDestinationPlaceLat(details.geometry.location.lat);
      setDestinationPlaceLng(details.geometry.location.lng)

      console.log('Destination lat:', details.geometry.location.lat, 'Destination lng:', details.geometry.location.lng);
    } else {
      console.log('No details available');
    }
            saveLastDestination(data.description || details.formatted_address);
          }}
          fetchDetails
          enablePoweredByContainer={false}
          suppressDefaultStyles
          query={{
              key: GOOGLE_API_KEY,
              language: 'en',
              components: 'country:ng',
          }}
          renderRow={(data)=> <PlaceRow data={data}/>
          }
          renderDescription={(data)=> data.description || data.vicinity
          }
          styles={{
              textInput:styles.textInput,
              container:{...styles.autocompleteContainer,top:55
              },
              separator:styles.separator,
              poweredContainer: styles.gPoweredContainer
          }}
          renderRightButton={() => (
            <AntDesign
              style={styles.bottomButton} 
              name="closecircle" 
              onPress={clearDestinationInput} 
            />
          )}
          onFail={(error) => console.error(error)}
          onNotFound={() => console.log('No results were found')}
          isSearching={(isSearching) => setLoading(isSearching)} // Set loading state
          // predefinedPlaces={[homePlace]}
        />
        {/* Activity Indicator */}
        {loading && <ActivityIndicator size="large" color="#0000ff" style={styles.activityIndicator} />}
    </View>
  )
}

export default DestinationSearchComponent