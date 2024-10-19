import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import styles from './styles'

const CustomButton = ({onPress, text, type}) => {
  return (
    <View>
        <TouchableOpacity 
            style={[styles.btnCon, 
                    styles[`secBtn_${type}`]]} 
            onPress={onPress}
        >
                
            <Text 
            style={[styles.btnTxt, 
                    styles[`text_${type}`]]}>
                {text}
            </Text>
            
        </TouchableOpacity>

        {/* Google Sign in */}
        {/* <TouchableOpacity style={styles.btnGoogleCon}>
            <Text style={styles.btnGoogleTxt}>Sign In with Google</Text>
        </TouchableOpacity> */}

        {/* Secondary Buttons */}
        {/* <View style={styles.secBtnSection}>
            <TouchableOpacity >
                <Text style={styles.secBtnTxt}>Forgot Password ?</Text>
            </TouchableOpacity>
            <TouchableOpacity >
                <Text style={styles.secBtnTxt}>Create Account</Text>
            </TouchableOpacity>
        </View> */}
    </View>
  )
}

export default CustomButton;