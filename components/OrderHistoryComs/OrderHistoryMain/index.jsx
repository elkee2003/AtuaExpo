import { View, Text, FlatList, TouchableOpacity, Pressable, ActivityIndicator } from 'react-native'
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
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    setLoading(true)
    try{
      const userOrders = await DataStore.query(Order, (order)=> order.userID.eq(dbUser.id));
      const sortedOrders = userOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(sortedOrders);
    }catch(e){
      console.error('Error fetching orders', e)
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{
    fetchOrders();
  }, [])

  if(loading){
    <ActivityIndicator size={'large'} style={styles.loading}/>
  }

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