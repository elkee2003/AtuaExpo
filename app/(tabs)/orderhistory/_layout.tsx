import React from 'react'
import { Stack } from 'expo-router'

const OrderHistoryLayout = () => {
  return (
    <Stack screenOptions={{
        headerShown:false
    }}>
        <Stack.Screen name='index'/>
    </Stack>
  )
}

export default OrderHistoryLayout