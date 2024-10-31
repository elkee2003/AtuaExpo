import { View, Text,TouchableOpacity, Alert, } from 'react-native';
import React from 'react';
import * as Clipboard from 'expo-clipboard';
import styles from './styles';
import { router } from 'expo-router';

const OrderHistoryList = ({order, onDelete, onCancel}) => {

  const goToOrderLiveUpdate = () =>{
    if(order.status === 'ACCEPTED'|| order.status === 'PICKEDUP'){
      router.push(`/screens/orderliveupdate/${order.id}`)
    }
  }

  const handleCopyPhoneNumber = async () => {
    if (order.courier && order.courier.phoneNumber) {
      await Clipboard.setStringAsync(order.courier.phoneNumber);
      Alert.alert('Phone Number Copied', 'You can paste it into the dialer to make a call.');
    }
  };

  const getStatusText = (status) => {
    if (status === 'DELIVERED') return 'Completed';
    if (status === 'ACCEPTED') return 'Accepted';
    return 'Pending';
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={goToOrderLiveUpdate}>
        <Text style={styles.subHeading}>Date:</Text>
        <Text style={styles.detail}>
          {order?.createdAt ? order?.createdAt.substring(0,10) : ''}
        </Text>

        <Text style={styles.subHeading}>Recipient Name:</Text>
        <Text style={styles.detail}>{order.recipientName}</Text>

        <Text style={styles.subHeading}>Item Sent:</Text>
        <Text  style={styles.detail}>{order.orderDetails}</Text>

        <Text style={styles.subHeading}>Destination:</Text>
        <Text  style={styles.detail}>
          {order?.parcelDestination 
            ?
              order?.parcelDestination.length > 20 
              ? `${order.parcelDestination.substring(0, 30)}...` 
              : order.parcelDestination
            : ''
          }
        </Text>

        <Text style={styles.subHeading}>Status:</Text>
        <View style={styles.statusRow}>
          <Text style={styles.detail}>
            {getStatusText(order.status)}
          </Text>
          {(order.status === 'DELIVERED' ||order.status === 'ACCEPTED') ? (
              <View style={styles.greenIcon}/>
            ):(
              <View style={styles.redIcon}/>
          )}
        </View>

        {/* Conditionally render courier details if available and status is not delivered */}
        {order.courier && order.status !== 'DELIVERED' && (
          <View>
            <Text style={styles.subHeading}>Courier Name:</Text>
            <Text  style={styles.detail}>{order.courier.firstName}</Text>
            <Text style={styles.subHeading}>Courier Phone number:</Text>
            <TouchableOpacity onPress={handleCopyPhoneNumber}>
              <Text style={styles.detail}>{order.courier.phoneNumber}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.priceTypeRow}>
          <View>
            <Text style={styles.subHeading}>Price:</Text>
            <Text  style={styles.priceType}>₦{order?.price?.toLocaleString()}</Text>
          </View>
          
          <View>
            <Text style={styles.subHeading}>Transport Type:</Text>
            <Text  style={styles.priceType}>{order?.transportationType}</Text>
          </View>
        </View>

        {/* Conditionally render courier details if available and status is not delivered */}
        {order.status === 'READY_FOR_PICKUP' && (
          <TouchableOpacity style={styles.deleteButtonCon} onPress={()=>{
            Alert.alert(
              'Delete Order',
              'Are you sure you want to delete this order',
              [
                {text:'Cancel', style:'cancel'},
                {text: 'Delete', style:'destructive', onPress:onDelete}
              ]
            );
          }} >
            <Text style={styles.deleteButtonTxt} >Delete Order</Text>
          </TouchableOpacity>
        )}

        {order.status === 'ACCEPTED' && (
          <TouchableOpacity 
            style={styles.cancelButtonCon} 
            onPress={() => {
              Alert.alert(
                'Cancel Order',
                'Are you sure you want to cancel this order?',
                [
                  { text: 'No', style: 'cancel' },
                  { text: 'Yes', style: 'destructive', onPress: onCancel }
                ]
              );
            }}
          >
            <Text style={styles.cancelButtonTxt}>Cancel Order</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  )
}

export default OrderHistoryList