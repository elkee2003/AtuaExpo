import { View, Text, useWindowDimensions, ActivityIndicator, Image, Pressable } from 'react-native';
import React, {useState, useEffect, useRef, useMemo} from 'react';
import BottomSheet, { BottomSheetView,} from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import {GOOGLE_API_KEY} from '../../keys';
import * as Location from 'expo-location';
// import { useLocationContext } from '../../../providers/LocationProvider';
import styles from './styles';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';


const OrderLiveUpdate = ({order, courier}) => {

    const {width, height} = useWindowDimensions();
    const mapRef = useRef(null)
    const bottomSheetRef = useRef(null)
    const snapPoints = useMemo(()=>['25%', '30%'], [])
    const [location, setLocation] = useState(null);

    const getImage=(type)=>{
        if (type === 'Micro X'){
            return require('../../assets/atuaImages/Bicycle.png')
        }
        if (type === 'Moto X'){
            return require('../../assets/atuaImages/Bike.jpg')
        }
        if (type === 'Maxi Batch'){
            return require('../../assets/atuaImages/top-UberXL.png')
        }
        if (type === 'Maxi'){
            return require('../../assets/atuaImages/Deliverybicycle.png')
        }
        return require('../../assets/atuaImages/Walk.png')
    }

    const originLoc = {latitude: order.parcelOriginLat, longitude: order.parcelOriginLng};

    const destinationLoc = {latitude: order.parcelDestinationLat, longitude: order.parcelDestinationLng};

    const courierLoc = {latitude: courier.lat, longitude: courier.lng};

    const getDestination = () =>{
        if(order.status === 'ACCEPTED'){
            return originLoc;
        }else{
            return destinationLoc;
        }
    }

    useEffect(()=>{
        if(courier?.lng && courier.lat){
            mapRef.current.animateToRegion({
                latitude: courier.lat,
                longitude: courier.lng,
                latitudeDelta:0.05,
                longitudeDelta:0.05
            })
        }
    },[courier?.lat, courier?.lng])

  return (
    <GestureHandlerRootView style={styles.container}>
        <Pressable onPress={()=>router.back()} style={styles.bckBtn}>
          <Ionicons name="arrow-back" style={styles.bckBtnIcon} />
        </Pressable>
        <MapView
        style={{width, height: height - 120}}
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
            // latitude: 4.8089763,
            // longitude:  7.0220555,
            // latitude: location.latitude,
            // longitude: location.longitude,
            latitude:order.parcelOriginLat || 4.8089763,
            longitude:order.parcelOriginLng || 7.0220555,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
        }}
        showsUserLocation
        >
            <MapViewDirections
                origin={courierLoc}
                destination={getDestination()}
                apikey={GOOGLE_API_KEY}
                // timePrecision='now'
                strokeWidth={3}
                strokeColor='red'
                // onReady={onDirectionReady}
            />

            {/* Origin Marker */}
            <Marker
                title={'Origin'}
                coordinate={originLoc}
            >
                <FontAwesome6 name="location-dot" size={35} color="green" />
            </Marker>

            {/* Destination Marker */}
            <Marker
                title={'Destination'}
                coordinate={destinationLoc}
            >
                <FontAwesome6 name="location-dot" size={35} color="green" />
            </Marker>

            {/* Courier Marker */}
            {courier?.lat && (
                <Marker
                title={courier.firstName}
                coordinate={courierLoc}
                >
                    <Image style={{width:50,
                    height:70,
                    resizeMode:'contain',
                    }} 
                    source={getImage(courier.transportationType)}/>
                </Marker>
                )
            }
        </MapView>

        <BottomSheet 
            ref={bottomSheetRef}
            snapPoints={snapPoints} 
            index={1} 
            topInset={0} // Ensure no inset from the top
            handleIndicatorStyle={{backgroundColor:'#666768', width:80}}
        >
            <BottomSheetView style={styles.contentContainer}>
                {courier.profilePic && (
                    <View style={styles.imageContainer}>
                        <Image source={{ uri:  courier?.profilePic }} style={styles.img} />
                    </View>
                )}
                <Text style={styles.courierName}>{courier.firstName}</Text>
            </BottomSheetView>
        </BottomSheet>
    </GestureHandlerRootView>
  )
}

export default OrderLiveUpdate