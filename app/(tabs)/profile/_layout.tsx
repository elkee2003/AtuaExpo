import React from 'react'
import { Stack } from 'expo-router'

const ProfileLayout = () => {
  return (
    <Stack screenOptions={{
        headerShown:false
    }}>
        <Stack.Screen name='index'/>
        <Stack.Screen name='editprofile'/>
    </Stack>
  )
}

export default ProfileLayout