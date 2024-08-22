import { View, useWindowDimensions, ActivityIndicator, Image } from 'react-native'
import React, {useState, useEffect} from 'react'
import MapView, {Marker} from 'react-native-maps';
import * as Location from 'expo-location';
import styles from './styles'
import TMediums from '../../../assets/data/TMediums'

const HomeMap = () => {
    const {width, height} = useWindowDimensions()
    const [location, setLocation] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);

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

    useEffect(() => {
        (async () => {
          
          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            setErrorMsg('Permission to access location was denied');
            return;
          }
    
          let location = await Location.getCurrentPositionAsync({});
          setLocation(location);
        })();
    }, []);

    if (!location){
        return <ActivityIndicator size={"large"}/>
    }

  return (
    <View style={styles.container}>
      <MapView
      style={{width, height: height - 120}}
      initialRegion={{
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }}
      showsUserLocation
      >
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

export default HomeMap