import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import React, {useState, useEffect} from 'react'
import OrderHistoryList from '../OrderHistoryList'
import { useAuthContext } from '@/providers/AuthProvider';
import { DataStore } from 'aws-amplify/datastore';
import { Order, Courier } from '../../../src/models';
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

      // Fetch Courier data for each Order in parallel
      const ordersWithCouriers = await Promise.all(
        sortedOrders.map(async(order)=>{
          if(order.orderCourierId && order.status !== 'DELIVERED'){
            const courier = await DataStore.query(Courier, (c)=>c.id.eq(order.orderCourierId));
            return {...order, courier: courier[0] || null}; // Attach courier details to each order
          }
          return { ...order, courier: null };
        })
      );
      setOrders(ordersWithCouriers);
    }catch(e){
      console.error('Error fetching orders', e.message)
    }finally{
      setLoading(false);
    }
  }

  const deleteOrder = async (orderId) =>{
    try {
      const orderToDelete = await DataStore.query(Order, orderId);
      if(orderToDelete && orderToDelete.status !== 'ACCEPTED'){
        await DataStore.delete(orderToDelete);
      }
    }catch(e){
      console.error('Error deleting order', e);
    }
  };

  const cancelOrder = async (orderId) =>{
    try{
      const orderToCancel = await DataStore.query(Order, orderId);
      if (orderToCancel && orderToCancel.status === 'ACCEPTED'){
        await DataStore.save(Order.copyOf(orderToCancel, (updated)=>{
          updated.status = 'READY_FOR_PICKUP';
          updated.orderCourierId = null;
        })
      );
      Alert.alert('Order Canceled', 'The order is now available for other couriers to pick up.');
      fetchOrders(); // Refresh the order list
      }
    }catch(e){
      console.error('Error canceling order', e);
    }
  };

  useEffect(()=>{
    fetchOrders();

    const subscription = DataStore.observe(Order).subscribe(({opType})=>{
      if(opType === 'INSERT' || opType === 'UPDATE' || opType === 'DELETE'){
        fetchOrders();
      }
    });

    return () => subscription.unsubscribe();
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

      {orders.length === 0 ? (
        <View style={styles.noOrdersCon}>
          <Text style={styles.noOrders}>
            No Orders
          </Text>
        </View>
      ) :(
        <FlatList
          data={orders}
          keyExtractor={(item)=>item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({item})=> <OrderHistoryList 
            order={item} 
            onDelete={()=>deleteOrder(item.id)}
            onCancel={() => cancelOrder(item.id)}
          />
          }
        />
      )}
    </View>
  )
}

export default OrderHistoryMain