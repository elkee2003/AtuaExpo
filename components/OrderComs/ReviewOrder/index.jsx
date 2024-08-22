import { View, Text, ScrollView, Pressable } from 'react-native'
import React from 'react'
import styles from './styles'
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocationContext } from '@/providers/LocationProvider';
import { useAuthContext } from '@/providers/AuthProvider';
import { useOrderContext } from '@/providers/OrderProvider';
import { router } from 'expo-router';

const ReviewOrder = () => {

  const {recipientName, recipientNumber, orderDetails, setRecipientName, setRecipientNumber, setOrderDetails, createOrder} = useOrderContext()

  const {originPlace, destinationPlace,setOriginPlace, setDestinationPlace} = useLocationContext()

  const goToSearchResults=()=>{
    router.push('/screens/searchresults')
  }

  return (
    <ScrollView style={styles.container}>

      {/* Recipients Name */}
      <View style={styles.firstTxtRow}>
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

      {/* Type of Courier Selected */}
      {/* <View style={styles.txtRow}>
          <Text style={styles.txtTitle}>Mode Of Delivery:{" "}</Text>
          <Text style={styles.txt}>{selectedType}</Text>
      </View>  */}

      {/* Origin Of Parcel */}
       <View style={styles.txtRow}>
          <Text style={styles.txtTitle}>From:{" "}</Text>
          <Text style={styles.txt}>{originPlace.data?.description || details?.formatted_address}</Text>
        </View>

        {/* Destination Of Parcel */}
        <View style={styles.txtRow}>
          <Text style={styles.txtTitle}>To:{" "}</Text>
          <Text style={styles.txt}>{destinationPlace.data?.description || details?.formatted_address}</Text>
        </View>

        {/* Order Button */}
        <Pressable
        onPress={goToSearchResults}
        style={styles.btn}>
            <Text style={styles.btnTxt}>
                Done
            </Text>
        </Pressable>

        {/* Back Button */}
        <Pressable onPress={()=>router.back()} style={styles.bckBtn}>
              <Ionicons name={'arrow-back'} style={styles.bckBtnIcon}/>
        </Pressable>
    </ScrollView>
  )
}

export default ReviewOrder