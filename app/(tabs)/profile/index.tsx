import { View, Text } from 'react-native'
import React from 'react'
import WriteProfile from '../../../components/ProfileComs/EditProfile'

const ProfilePage = () => {
  return (
    <View style={{flex:1}}>
      {/* Note that its mainprofile thats meant to be here */}
      <WriteProfile/>
    </View>
  )
}

export default ProfilePage