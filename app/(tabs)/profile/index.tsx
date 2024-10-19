import { View, Text } from 'react-native'
import React from 'react'
import EditProfile from '../../../components/ProfileComs/EditProfile'
import MainProfile from '../../../components/ProfileComs/MainProfile'
import { useAuthContext } from '@/providers/AuthProvider'

const ProfilePage = () => {

  const {dbUser} = useAuthContext()

  return (
    <View style={{flex:1}}>
      {/* Note that its mainprofile thats meant to be here */}
      {dbUser ?
        <MainProfile/>
      :
        <EditProfile/>
      }
    </View>
  )
}

export default ProfilePage