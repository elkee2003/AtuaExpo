import React from 'react';
import { Tabs } from 'expo-router';
import { Entypo } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';

const TabsLayout = () => {
  return (
    <Tabs screenOptions={{
        headerShown:false
    }}>
        <Tabs.Screen
        name='home'
        options={{
            tabBarLabel:'Home',
            tabBarIcon:({color})=><Entypo name="home" size={24} color={color} />
        }}
        />
        <Tabs.Screen
        name='orderhistory'
        options={{
            tabBarLabel:'History',
            tabBarIcon:({color})=><FontAwesome5 name="clipboard-list" size={24} color={color} />
        }}
        />
        <Tabs.Screen
        name='profile'
        options={{
            tabBarLabel:'Profile',
            tabBarIcon:({color})=><Ionicons name="person-sharp" size={24} color={color} />
        }}
        />
    </Tabs>
  )
}

export default TabsLayout