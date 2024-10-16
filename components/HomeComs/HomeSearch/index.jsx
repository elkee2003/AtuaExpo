import { View, Text, TouchableOpacity } from 'react-native'
import React, {useEffect} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocationContext } from '@/providers/LocationProvider';
import styles from './styles'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import AntDesign from '@expo/vector-icons/AntDesign';
import { router } from 'expo-router';

const HomeSearch = () => {

  const {lastDestination, setLastDestination} = useLocationContext()

  useEffect(() => {
  // Function to retrieve the last destination from AsyncStorage
  const getLastDestination = async () => {
    try {
      const destination = await AsyncStorage.getItem('lastDestination');
      if (destination !== null) {
        setLastDestination(destination);
      }
    } catch (error) {
      console.error('Failed to load the last destination:', error);
    }
  };

  getLastDestination();
  }, []);

  return (
    <View>
       {/* input box */}
       <TouchableOpacity style={styles.inputBox} onPress={()=>router.push('/screens/destinationsearch')}>
            <Text style={styles.inputText}>
              What's the destination?
            </Text>
            <View style={styles.orderContainer}>
            <FontAwesome5 name={'search-location'} size={25}/>
            </View>
        </TouchableOpacity>

        {/* previous destination */}
        {lastDestination && (<View style={styles.row}>
            <View style={styles.iconContainer}>
            <AntDesign name={'clockcircle'} size={16} color={'#535353'}/>
            </View>
            <Text style={styles.destinationText }>{lastDestination.length > 25 ? `${lastDestination.substring(0,30)}...` : lastDestination}</Text>
        </View>
        )}

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