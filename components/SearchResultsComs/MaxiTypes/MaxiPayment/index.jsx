import { View, Text, TouchableOpacity, TextInput, Alert } from 'react-native'
import React, {useState, useEffect} from 'react'
import styles from './styles';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useOrderContext} from '../../../../providers/OrderProvider';
import { router } from 'expo-router';
import {PayWithFlutterwave} from 'flutterwave-react-native';
import { FLUTTER_WAVE_KEY } from '../../../../keys';

const PaymentComponent = () => {

    const [amount, setAmount] = useState('')
    const {price} = useOrderContext()

    // Function to handle the redirect after payment
    const handleOnRedirect = (data) => {
      console.log('Payment Status:', data.status);
      console.log('Transaction Reference:', data.tx_ref);
      if (data.status === 'successful') {
        // Perform actions after successful payment
        console.log('Transaction ID:', data.transaction_id);
        alert('Payment Successful!');
        router.push('/screens/checkout')
      } else if (data.status === 'cancelled') {
        // Perform actions if payment is cancelled
        alert('Payment Cancelled.');
      }
    };


    // Function to generate a random transaction reference
    const generateTransactionRef = (length) => {
      var result = '';
      var characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      var charactersLength = characters.length;
      for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
      }
      return `flw_tx_ref_${result}`;
    };

  return (
    <View>


      {/* Flutterwave Payment Button */}
      <PayWithFlutterwave
        onRedirect={handleOnRedirect}
        options={{
          tx_ref: generateTransactionRef(10),  // Generate a unique transaction reference
          authorization: FLUTTER_WAVE_KEY,  // Replace with your Flutterwave public key
          customer: {
            email: 'customer-email@example.com',  // Customer's email
          },
          amount: Number(price),  // Payment amount
          currency: 'NGN',  // Currency (e.g., NGN for Nigerian Naira)
          payment_options: 'card, ussd, mobilemoney',  // Payment options (e.g., card, mobilemoney, etc.)
        }}
        customButton={(props) => (
          <TouchableOpacity
            style={styles.btnContainer}
            onPress={props.onPress}  // Trigger payment on button press
            disabled={props.disabled}
          >
            <Text style={styles.btnTxt}>Pay Now</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

export default PaymentComponent;