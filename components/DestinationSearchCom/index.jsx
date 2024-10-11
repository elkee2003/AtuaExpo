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
import { router } from 'expo-router';

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

    const {originPlace, destinationPlace, setOriginPlace, setDestinationPlace} = useLocationContext()

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
    
  

  return (
    <View style={styles.container}>

        {/* From? */}
        <GooglePlacesAutocomplete
          placeholder='From?'
          ref={originAutocompleteRef}
          onPress={(data, details = null) => {
            setOriginPlace({data, details})
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