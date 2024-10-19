import { View, Text, FlatList, TouchableOpacity, Pressable } from 'react-native'
import React, {useState, useEffect} from 'react'
import orders from '../../../assets/data/orders.json'
import OrderHistoryList from '../OrderHistoryList'
import { useAuthContext } from '@/providers/AuthProvider';
import { DataStore } from 'aws-amplify/datastore';
import { Order } from '../../../src/models';
import styles from './styles'

const OrderHistoryMain = () => {

  const {dbUser} = useAuthContext()
  const [orders, setOrders] = useState([]);

  const fetchOrders = async () => {
    try{
      const userOrders = await DataStore.query(Order, (order)=> order.userID.eq(dbUser.id));
      setOrders(userOrders)
    }catch(e){
      console.error('Error fetching orders', e)
    }
  }

  useEffect(()=>{
    fetchOrders();
  }, [])

  return (
    <View style={styles.container}>
      
      {/* Header */}
      <View>
        <Text style={styles.header}>Order History</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item)=>item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({item})=> <OrderHistoryList order={item}/>}
        ListEmptyComponent={
          <View style={styles.noOrderFoundCon}>
            <Text style={styles.noOrderFound}>
              No orders found
            </Text>
          </View>}
      />
    </View>
  )
}

export default OrderHistoryMain