import { View, useWindowDimensions, ActivityIndicator, Image, PermissionsAndroid, Platform, } from 'react-native'
import React, {useState, useEffect, useCallback} from 'react'
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import MapViewDirections from 'react-native-maps-directions';
import {GOOGLE_API_KEY} from '../../../keys'
import * as Location from 'expo-location';
import { useLocationContext } from '../../../providers/LocationProvider'
import styles from './styles'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import holidays from '../../../assets/data/holiday'
import TMediums from '../../../assets/data/TMediums'

const ResultMap = ({
  setTotalMins,
  setTotalKm,
  setIsPeakHour,
  setIsWeekend, 
//   setIsLongDistance,
//   setIsRushDelivery,
  setIsNightTime,
  setIsHoliday,
//   setIsHighTrafficArea, //yet to add logic
//   setIsHeavyItem, //yet to add logic
//   setIsFragileItem, //yet to add logic
}) => {
    const {width, height} = useWindowDimensions()
    const [location, setLocation] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [currentDateTime, setCurrentDateTime] = useState(new Date());

    const {originPlace, destinationPlace} = useLocationContext()

    const originLoc = {
      latitude: originPlace?.details?.geometry?.location?.lat || 4.8089763,
      longitude: originPlace?.details?.geometry?.location?.lng || 7.0220555,
    }
  
    const destinationLoc ={
      latitude: destinationPlace?.details?.geometry?.location?.lat || 6.5243793,
      longitude: destinationPlace?.details?.geometry?.location?.lng || 3.3792057,
    };

    const getImage=(type)=>{
      if (type === 'Micro X'){
          return require('../../../assets/atuaImages/Bicycle.png')
      }
      if (type === 'Moto X'){
          return require('../../../assets/atuaImages/Bike.jpg')
      }
      if (type === 'Maxi Batch'){
          return require('../../../assets/atuaImages/top-UberXL.png')
      }
      if (type === 'Maxi'){
          return require('../../../assets/atuaImages/Deliverybicycle.png')
      }
      return require('../../../assets/atuaImages/Walk.png')
    }

    const onDirectionReady = (result) =>{
        const distance = result.distance;
        const duration = result.duration;

        setTotalKm(distance.toFixed(2))
        setTotalMins(duration.toFixed(0))
    }

    const checkIfHoliday = (date) => {
        const month = date.getMonth() + 1; // getMonth() returns 0-11
        const day = date.getDate();
        const formattedDate = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        return holidays.includes(formattedDate);
    };

    const updateTimeDependentStates = () => {
        const currentHour = currentDateTime.getHours();
        const currentDay = currentDateTime.getDay();
        const today = new Date(currentDateTime);
    
        // Detect peak hours (e.g., 5 PM to 8 PM)
        setIsPeakHour(currentHour >= 17 && currentHour <= 20);
        setIsNightTime(currentHour >= 22 || currentHour < 5);
        setIsWeekend(currentDay === 0 || currentDay === 6);
        setIsHoliday(checkIfHoliday(today));
    };

    // const checkHighTrafficArea = (location) => {
    // // Implement your logic to check if the location is a high-traffic area
    // return false; // Example: return true if it's a high-traffic area
    // };

    useEffect(() => {
        updateTimeDependentStates();
    }, [currentDateTime]);

    useEffect(() => {
        let watchId;
    
        const requestLocationPermission = async () => {
            try {
                // For both iOS and Android
                if (Platform.OS === 'ios' || Platform.OS === 'android') {
                Geolocation.requestAuthorization(); // Request permission on iOS and Android
                }
        
                // Watch the user's location and update it continuously
                watchId = Geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setLocation({ latitude, longitude });
                    console.log('Updated Location:', position);
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    setErrorMsg('Error fetching location');
                },
                {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 1000,
                    distanceFilter: 500, // Update based on distance (e.g., every 500 meters)
                }
                );
            } catch (error) {
                console.error('Location permission error:', error);
                setErrorMsg('Failed to request location permission');
            }
        };
    
        requestLocationPermission();
    
        // Cleanup subscription when the component unmounts
        return () => {
          if (watchId !== null) {
            Geolocation.clearWatch(watchId);
          }
        };
    }, []);

    // if (!location || !location.latitude || !location.longitude) {
    //     return <ActivityIndicator style={{ marginTop: 30 }} size="large" />;
    // }


  return (
    <View style={styles.container}>
      <MapView
      style={{width, height: height - 100}}
      provider={PROVIDER_GOOGLE}
      initialRegion={{
        // latitude: 4.8089763,
        // longitude:  7.0220555,
        // latitude: location.latitude,
        // longitude: location.longitude,
        latitude:originPlace?.details.geometry.location.lat || 4.8089763,
        longitude:originPlace?.details.geometry.location.lng || 7.0220555,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }}
      showsUserLocation
      >
        <MapViewDirections
            origin={originLoc}
            destination={destinationLoc}
            apikey={GOOGLE_API_KEY}
            timePrecision='now'
            strokeWidth={3}
            strokeColor='red'
            onReady={onDirectionReady}
        />

        {/* Origin Marker */}
        <Marker
        title={'Origin'}
        description={originPlace?.data?.description || 'Origin description not available'}
        coordinate={originLoc}
        >
          <FontAwesome6 name="location-dot" size={35} color="green" />
        </Marker>

        {/* Destination Marker */}
        <Marker
        title={'Destination'}
        description={destinationPlace?.data?.description || 'Destination description not available'}
        coordinate={destinationLoc}
        >
          <FontAwesome6 name="location-dot" size={35} color="darkgreen" />
        </Marker>

        {/* Courier Markers */}
        {TMediums.map((TMedium)=>{
          return <Marker
                key={TMedium.id}
                coordinate={{ latitude : TMedium.latitude , longitude : TMedium.longitude }}>
                  <Image style={{width:50,
                  height:70,
                  resizeMode:'contain',
                  transform:[{
                  rotate:`${TMedium.heading}.deg`
                  }]
                  }} 
                 source={getImage(TMedium.type)}/>
                </Marker>
        })}
        
      </MapView>
    </View>
  )
}

export default ResultMap