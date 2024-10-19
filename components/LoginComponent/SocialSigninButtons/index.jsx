import { View, Text } from 'react-native'
import React from 'react'
import CustomButton from '../customButtons'
import styles from './styles'

const SocialSigninButton = () => {

  const onGoogleSignInPressed = () =>{
    console.warn('Sign in with Google')
  }
  const onAppleSignInPressed = () =>{
    console.warn('Sign in with Apple')
  }

  return (
    <View>
      <CustomButton 
            text='Sign In With Google' 
            onPress={onGoogleSignInPressed}
            type='Google'
      />
      <CustomButton 
            text='Sign In With Apple' 
            onPress={onAppleSignInPressed}
            type='Apple'
      />
    </View>
  )
}

export default SocialSigninButton;