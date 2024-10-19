import { View, Text, TextInput, TouchableOpacity, } from 'react-native'
import React, {useState} from 'react'
import styles from './styles'
import {useOrderContext} from '../../../providers/OrderProvider'
import {useAuthContext} from '../../../providers/AuthProvider'
import {useLocationContext} from '../../../providers/LocationProvider'
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router'
import { useLocalSearchParams } from 'expo-router'

const WriteOrder = () => {

    const {recipientName, recipientNumber, orderDetails, setRecipientName, setRecipientNumber, setOrderDetails, orders, setOrders,} = useOrderContext()

    const {dbuser, sub}= useAuthContext()

    const {originPlace, destinationPlace} = useLocationContext()

    console.log('orgin lat:', originPlace.details.geometry.location.lat, 'orgin lng:',originPlace.details.geometry.location.lng,)
    console.log('destination lat:', destinationPlace.details.geometry.location.lat, 'destination lng:',destinationPlace.details.geometry.location.lng,)
    console.log('This is details origin?:', originPlace.data?.description || details?.formatted_address)
    console.log('This is details destination?:', destinationPlace.data?.description || details?.formatted_address)


    const [recipientNameError, setRecipientNameError] = useState('');
    const [recipientNumberError, setRecipientNumberError] = useState('');

    const goToReviewOrder = ()=>{
        let hasError = false;
        
        // !recipientName.trim() is if the space is empty
        if(!recipientName.trim() || recipientName.length < 2){
            setRecipientNameError('Kindly input the name of recipient.')
            hasError= true;
        }else{
            setRecipientNameError('')
        }

        if(recipientNumber.length < 11){
            setRecipientNumberError('Phone number must be at least 11 characters.')
            hasError = true;
        }else{
            setRecipientNumberError(" ")
        }

        if(!hasError){
            router.push('/screens/revieworder')
        }
    }

  return (
    <View style={styles.container}>
        <TouchableOpacity onPress={()=>router.back()} style={styles.bckBtn}>
          <Ionicons name="arrow-back" style={styles.bckBtnIcon} />
        </TouchableOpacity>
        <Text style={styles.header}>Recipient / Package Details:</Text>
    
        <TextInput
            style={styles.input}
            value={recipientName}
            onChangeText={(text)=>setRecipientName(text)}
            multiline
            placeholder='Sending to eg: Opus'
        />
        {recipientNameError ? <Text style={styles.error}>{recipientNameError}</Text> : null}
        <TextInput
            style={styles.input}
            value={recipientNumber}
            onChangeText={(text)=>setRecipientNumber(text)}
            multiline
            placeholder='eg: 08030000000'
            keyboardType='number-pad'
        />
        {recipientNumberError ? <Text style={styles.error}>{recipientNumberError}</Text> : null}
        <TextInput
            style={styles.description}
            value={orderDetails}
            onChangeText={(text)=>setOrderDetails(text)}
            multiline
            placeholder='eg: Letter, Food, Clothes, Breakable Items etc. You can also drop a short note. Kindly make it as short as possible'
        />
        <TouchableOpacity onPress={goToReviewOrder} style={styles.btn}>
            <Text style={styles.btnTxt}>
                Review
            </Text>
        </TouchableOpacity>
    </View>
  )
}

export default WriteOrder