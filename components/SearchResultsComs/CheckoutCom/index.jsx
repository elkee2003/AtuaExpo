import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import React from 'react'
import styles from './styles'
import { useOrderContext } from '../../../providers/OrderProvider';
import { useLocationContext } from '../../../providers/LocationProvider';
import {useAuthContext} from '../../../providers/AuthProvider';
import { router } from 'expo-router';
import { DataStore } from 'aws-amplify/datastore';
import {Order} from '../../../src/models'

const Checkout = () => {

    const {dbUser} = useAuthContext();

    const {recipientName, recipientNumber, orderDetails, setRecipientName, setRecipientNumber, setOrderDetails, transportationType, setTransportationType, orders, setOrders,price, setPrice,} = useOrderContext();

    const {originPlace, setOriginPlace, destinationPlace, setDestinationPlace,originPlaceLat, setOriginPlaceLat,originPlaceLng, setOriginPlaceLng,destinationPlaceLat, setDestinationPlaceLat, destinationPlaceLng, setDestinationPlaceLng,} = useLocationContext();

    const handleOrder = async () =>{
        try{
            const order = await DataStore.save(new Order({
                recipientName,
                recipientNumber,
                orderDetails,
                transportationType,
                price: parseFloat(price),
                parcelOrigin: originPlace?.data?.description ,
                parcelOriginLat: parseFloat(originPlaceLat),
                parcelOriginLng: parseFloat(originPlaceLng),
                parcelDestination: destinationPlace?.data?.description ,
                parcelDestinationLat: parseFloat(destinationPlaceLat),
                parcelDestinationLng: parseFloat(destinationPlaceLng),
                userID: dbUser.id,
                status: 'READY_FOR_PICKUP'
            }))
            setOrders(order)
            Alert.alert("Successful", "Order was a success")
            
            setRecipientName('')
            setRecipientNumber('')
            setOrderDetails('')
            setTransportationType('')
            setPrice('')
            setOriginPlace(null)
            setOriginPlaceLat('')
            setOriginPlaceLng('')
            setDestinationPlace(null)
            setDestinationPlaceLat('')
            setDestinationPlaceLng('')

            router.push('/home')
        }catch(e){
            Alert.alert( 'Error', e.message)
        }
    }

  return (
    <View style={styles.container}>
        <Text style={styles.title}>Order</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
            {/* Recipients Name */}
            <View style={styles.txtRow}>
                <Text style={styles.txtTitle}>Recipient's Name:{" "}</Text>
                <Text style={styles.txt}>{recipientName}</Text>
            </View>

            {/* Recipients Number */}
            <View style={styles.txtRow}>
                <Text style={styles.txtTitle}> Recipient's Phone Number:{" "}</Text>
                <Text style={styles.txt}>{recipientNumber}</Text>
            </View>

            {/* Order Details */}
            {orderDetails &&
            <View style={styles.txtRow}>
                <Text style={styles.txtTitle}>Details Of Order:{" "}</Text>
                <Text style={styles.txt}>{orderDetails}</Text>
            </View>
            }

            {/* Origin Of Parcel */}
            <View style={styles.txtRow}>
                <Text style={styles.txtTitle}>From:{" "}</Text>
                <Text style={styles.txt}>{originPlace?.data?.description }</Text>
            </View>

            {/* Destination Of Parcel */}
            <View style={styles.txtRow}>
                <Text style={styles.txtTitle}>To:{" "}</Text>
                <Text style={styles.txt}>{destinationPlace?.data?.description }</Text>
            </View>

            <View style={styles.txtRow}>
                <Text style={styles.txtTitle}>Transportation Type: {" "}</Text>
                <Text style={styles.txt}>{transportationType}</Text>
            </View>

            <View style={styles.txtRow}>
                <Text style={styles.txtTitle}>Price: {" "}</Text>
                <Text style={styles.txt}>₦{price}</Text>
            </View>
        </ScrollView>
        <TouchableOpacity style={styles.btnContainer} onPress={handleOrder}>
            <Text style={styles.btnTxt}>Order</Text>
        </TouchableOpacity>
    </View>
  )
}

export default Checkout;