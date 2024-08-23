import { View, Text, FlatList, TouchableOpacity, Pressable } from 'react-native'
import React from 'react'
import orders from '../../../assets/data/orders.json'
import styles from './styles'

const OrderHistoryMain = () => {
  return (
    <View style={styles.container}>
      
      {/* Header */}
      <View>
        <Text style={styles.header}>Order History</Text>
      </View>

      <FlatList
      data={orders}
      renderItem={({item})=>(
        <Pressable style={styles.page}>
          <View>
            {/* Name of Courier */}
            <Text style={styles.name}>Courier name: {item.Courier.name}</Text>

            {/* Price of Logistics */}
            <Text style={styles.price}>₦1700.69</Text>
         
            {/* Content of Parcel */}
            <Text>Food</Text>

            {/* Number of days ago */}
            <Text>2 days ago</Text>
          </View>
        </Pressable>
      )}
      />
    </View>
  )
}

export default OrderHistoryMain