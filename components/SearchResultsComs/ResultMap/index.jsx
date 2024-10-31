import { View, useWindowDimensions, ActivityIndicator, Image } from 'react-native';
import React, {useState, useEffect} from 'react';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import {GOOGLE_API_KEY} from '../../../keys';
import * as Location from 'expo-location';
import { useLocationContext } from '../../../providers/LocationProvider';
import styles from './styles';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import holidays from '../../../assets/data/holiday';
import { DataStore } from 'aws-amplify/datastore';
import {Courier} from '@/src/models';

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
    const [couriers, setCouriers] = useState([]);
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

    const fetchCouriers = async () =>{
      try{
        const onlineCouriers = await DataStore.query(Courier, (c)=>c.isOnline.eq(true));
        setCouriers(onlineCouriers);
      }catch(e){
        Alert.alert('Error', e.message)
      }
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

    useEffect(()=>{
      fetchCouriers()

      const subscription = DataStore.observe(Courier).subscribe(({opType})=>{
        if(opType === 'INSERT' || opType === 'UPDATE' || opType === 'DELETE'){
          fetchCouriers();
        }
      });
  
      return () => subscription.unsubscribe();
    },[])
    

    useEffect(() => {
      (async () => {
        try {
          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            setErrorMsg('Permission to access location was denied');
            return;
          }
    
          let location = await Location.getCurrentPositionAsync({});
          setLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        } catch (error) {
          console.error('Error fetching location:', error);
          setErrorMsg('Failed to fetch location');
        }
      })();
    }, []);

    if (!location || !location.latitude || !location.longitude) {
        return <ActivityIndicator style={{ marginTop: 30 }} size="large" />;
    }


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
        {couriers.map((courier)=>{
          return <Marker
                key={courier.id}
                coordinate={{ latitude : courier.lat , longitude : courier.lng }}>
                  <Image style={{width:50,
                  height:70,
                  resizeMode:'contain',
                  }} 
                 source={getImage(courier.transportationType)}/>
                </Marker>
        })}
        
      </MapView>
    </View>
  )
}

export default ResultMap;