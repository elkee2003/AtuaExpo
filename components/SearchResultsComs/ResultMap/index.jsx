import { View, useWindowDimensions, ActivityIndicator, Image } from 'react-native'
import React, {useState, useEffect} from 'react'
import MapView, {Marker} from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import {GOOGLE_API_KEY} from '../../../keys'
import * as Location from 'expo-location';
import { useLocationContext } from '@/providers/LocationProvider';
import styles from './styles'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import TMediums from '../../../assets/data/TMediums'

const ResultMap = ({
  setTotalMins,
  setTotalKm,
  setIsPeakHour,
  setIsWeekend,
  setIsHighTrafficArea,
  setIsLongDistance,
  setIsRushDelivery,
  setIsNightTime,
  setIsHoliday,
  setIsHeavyItem,
  setIsFragileItem,
}) => {
    const {width, height} = useWindowDimensions()
    const [location, setLocation] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [currentHour, setCurrentHour] = useState(new Date().getHours());

    const {originPlace, destinationPlace} = useLocationContext()

    const originLoc = {
        latitude:originPlace.details.geometry.location.lat,
        longitude:originPlace.details.geometry.location.lng
      }
    const destinationLoc = {
        latitude:destinationPlace.details.geometry.location.lat,
        longitude:destinationPlace.details.geometry.location.lng
    }

    const getImage=(type)=>{
      if (type === 'BICYCLE'){
          return require('../../../assets/atuaImages/Walk.png')
      }
      if (type === 'Bike'){
          return require('../../../assets/atuaImages/Bike.jpg')
      }
      if (type === 'Car'){
          return require('../../../assets/atuaImages/top-UberXL.png')
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
    // Implement your logic to check if today is a holiday
    return false; // Example: return true if it's a holiday
    };

    const checkHighTrafficArea = (location) => {
    // Implement your logic to check if the location is a high-traffic area
    return false; // Example: return true if it's a high-traffic area
    };

    useEffect(() => {
        const currentDay = new Date().getDay();

        // Detect peak hours (e.g., 5 PM to 8 PM)
        setIsPeakHour(currentHour >= 17 && currentHour <= 20);
        setIsWeekend(currentDay === 0 || currentDay === 6);
        setIsNightTime(currentHour >= 22 || currentHour < 5);
        setIsHoliday(checkIfHoliday(new Date()));
        setIsHeavyItem(false); // Assuming itemWeight is available
        setIsFragileItem(false); // Assuming this is determined from item properties

        // Here you could add logic to detect if the user is in a high-traffic area
        // You might use specific coordinates or a third-party service to check this

        // const isHighTrafficArea = // Your logic to detect high-traffic area
        // setIsHighTrafficArea(isHighTrafficArea);

        // new surcharge
        // setIsLongDistance(distance > 25);
        // setIsRushDelivery(false); // e.g., based on user input
    }, [location, currentHour]);

    useEffect(() => {
        let foregroundSubscription;

        (async () => {
            try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setErrorMsg('Permission to access location was denied');
                    return;
                }

                let currentLocation = await Location.getCurrentPositionAsync({});
                console.log("Initial location:", currentLocation);

                if (currentLocation && currentLocation.coords) {
                    setLocation({
                        coords: {
                            latitude: currentLocation.coords.latitude,
                            longitude: currentLocation.coords.longitude
                        }
                    });

                    foregroundSubscription = await Location.watchPositionAsync(
                        {
                            accuracy: Location.Accuracy.High,
                            distanceInterval: 500,
                            timeInterval: 10000,
                        },
                        (updatedLocation) => {
                            console.log("Updated location:", updatedLocation);

                            if (updatedLocation && updatedLocation.coords) {
                                setLocation({
                                    coords: {
                                        latitude: updatedLocation.coords.latitude,
                                        longitude: updatedLocation.coords.longitude,
                                    }
                                });
                            } else {
                                console.error("Updated location is undefined or missing coords");
                            }
                        }
                    );

                    if (!foregroundSubscription) {
                        console.error("Location subscription failed.");
                    }
                } else {
                    console.error("Initial location is undefined or missing coords");
                }
            } catch (error) {
                console.error("Error fetching location:", error);
                setErrorMsg("Error fetching location. Please try again.");
            }
        })();

        return () => {
            if (foregroundSubscription) {
                foregroundSubscription.remove();
            }
        };
    }, []);

    if (!location || !location.coords.latitude || !location.coords.longitude) {
        return <ActivityIndicator style={{ marginTop: 30 }} size={"large"} />;
    }


  return (
    <View style={styles.container}>
      <MapView
      style={{width, height: height - 100}}
      initialRegion={{
        // latitude: 4.8089763,
        // longitude:  7.0220555,
        latitude:originPlace.details.geometry.location.lat,
        longitude:originPlace.details.geometry.location.lng,
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
        description={originPlace?.data?.description}
        coordinate={originLoc}
        >
          <FontAwesome6 name="location-dot" size={35} color="green" />
        </Marker>

        {/* Destination Marker */}
        <Marker
        title={'Destination'}
        description={destinationPlace?.data?.description}
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