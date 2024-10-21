import { View, Text,TouchableOpacity } from 'react-native'
import React from 'react'
import styles from './styles'

const OrderHistoryList = ({order}) => {
  return (
    <View style={styles.container}>
      <View style={styles.page}>
        <Text style={styles.subHeading}>Date:</Text>
        <Text style={styles.detail}>{order.createdAt.substring(0,10)}</Text>

        <Text style={styles.subHeading}>Recipient Name:</Text>
        <Text style={styles.detail}>{order.recipientName}</Text>

        <Text style={styles.subHeading}>Item Sent:</Text>
        <Text  style={styles.detail}>{order.orderDetails}</Text>

        <Text style={styles.subHeading}>Destination:</Text>
        <Text  style={styles.detail}>{order.parcelDestination}</Text>

        <View style={styles.priceTypeRow}>
          <View>
            <Text style={styles.subHeading}>Price:</Text>
            <Text  style={styles.priceType}>₦{order.price.toLocaleString()}</Text>
          </View>
          
          <View>
            <Text style={styles.subHeading}>Transport Type:</Text>
            <Text  style={styles.priceType}>{order.transportationType}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

export default OrderHistoryList