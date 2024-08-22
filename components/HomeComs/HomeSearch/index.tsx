import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import styles from './styles'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import AntDesign from '@expo/vector-icons/AntDesign';
import { router } from 'expo-router';

const HomeSearch = () => {
  return (
    <View>
       {/* input box */}
       <TouchableOpacity style={styles.inputBox} onPress={()=>router.push('/screens/destinationsearch')}>
            <Text style={styles.inputText}>Send To What Location?
            </Text>
            <View style={styles.orderContainer}>
            <FontAwesome5 name={'search-location'} size={30}/>
            </View>
        </TouchableOpacity>

        {/* previous destination */}
        <View style={styles.row}>
            <View style={styles.iconContainer}>
            <AntDesign name={'clockcircle'} size={16} color={'#535353'}/>
            </View>
            <Text style={styles.destinationText }>Trans Amadi Port Harcourt</Text>
        </View>

        {/* home destination */}
        <View style={styles.row}>
            <View style={[styles.iconContainer,{backgroundColor:'#04a835'}]}>
            <AntDesign name="home" size={16} color="#535353" />
            </View>
            <Text style={styles.destinationText }>'Home Address'</Text>
        </View>
    </View>
  )
}

export default HomeSearch