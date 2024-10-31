import { View, Text, SafeAreaView, ActivityIndicator } from 'react-native';
import React, {useState, useEffect} from 'react';
import { useLocalSearchParams } from 'expo-router';
import OrderLiveUpdateCom from '../../../components/OrderLiveUpdate';
import { DataStore } from 'aws-amplify/datastore';
import {Order, Courier} from '@/src/models';

const OrderLiveUpdate = () => {

    const [courier, setCourier] = useState([]);
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    const {id}= useLocalSearchParams();

    const fetchTrackedOrder = async (id) =>{
      
      setLoading(true);
      try{
          if(id){
              const trackedOrder = await DataStore.query(Order, id);

              setOrder(trackedOrder);

              if(trackedOrder){
                // Fetch the Courier realted to the Order
                const trackedCourier = await DataStore.query(Courier, trackedOrder.orderCourierId);
                setCourier(trackedCourier);
              }
          }
      }catch(e){
          console.error('Error Fetching Order', e.message);
      }finally{
          setLoading(false);
      }
    }

    useEffect(()=>{
      fetchTrackedOrder(id)
    },[id])

    // useEffect to update Order
    useEffect(()=>{
      if(!order){
        return;
      }

      const subscription =  DataStore.observe(Order, order.id).subscribe(({opType, element})=>{
        if(opType === 'UPDATE'){
          setOrder(element);
        }
      });

      return () => subscription.unsubscribe;
    },[order])

    // useEffect to update Courier
    useEffect(()=>{
      if(!courier){
       return;
      }

      const subscription =  DataStore.observe(Courier, courier.id).subscribe(({opType, element})=>{
        if(opType === 'UPDATE'){
          setCourier(element);
        }
      });

      return () => subscription.unsubscribe;
    },[courier.id])

    if(!order || !courier){
      return(
        <View style={{top:'50%', justifyContent:'center', alignItems:'center'}}>
          <ActivityIndicator size="large" color='#3cff00'/>
        </View>
      )
    }

    if (loading) {
      return (
        <View style={{top:'10%', justifyContent:'center', alignItems:'center'}}>
          <ActivityIndicator size="large" color='#3cff00'/>
        </View>
      );
    }

  return (
    <View style={{flex:1}}>
      <OrderLiveUpdateCom order={order} courier={courier}/>
    </View>
  )
}

export default OrderLiveUpdate;