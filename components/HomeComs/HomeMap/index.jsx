import { View, useWindowDimensions, ActivityIndicator, Image, Alert } from 'react-native'
import React, {useState, useEffect} from 'react'
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import * as Location from 'expo-location';
import styles from './styles'
import { DataStore } from 'aws-amplify/datastore';
import {Courier} from '@/src/models';
import TMediums from '../../../assets/data/TMediums'

const HomeMap = () => {
    const {width, height} = useWindowDimensions();
    const [couriers, setCouriers] = useState([]);
    const [location, setLocation] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);

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

    const fetchCouriers = async () =>{
      try{
        const onlineCouriers = await DataStore.query(Courier, (c)=>c.isOnline.eq(true));
        setCouriers(onlineCouriers);
      }catch(e){
        Alert.alert('Error', e.message)
      }
      const fetchedCouriers = await DataStore.query(Courier);
      setCouriers(fetchedCouriers)
    }

    useEffect(()=>{
      fetchCouriers()
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
      style={{width, height: height - 120}}
      provider={PROVIDER_GOOGLE}
      initialRegion={{
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }}
      showsUserLocation
      >
        {/* {TMediums.map((TMedium)=>{ */}
        {couriers.map((courier)=>{
          return <Marker
                key={courier.id}
                coordinate={{ latitude : courier.lat , longitude : courier.lng }}>
                  <Image style={{width:50,
                  height:70,
                  resizeMode:'contain',
                  // transform:[{
                  // rotate:`${TMedium.heading}.deg`
                  // }]
                  }} 
                 source={getImage(courier.transportationType)}/>
                </Marker>
        })}
      </MapView>
    </View>
  )
}

export default HomeMap