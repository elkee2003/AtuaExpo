import { View, Text, TouchableOpacity, Pressable } from 'react-native'
import React, {useEffect} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocationContext } from '@/providers/LocationProvider';
import { useProfileContext } from '@/providers/ProfileProvider';
import styles from './styles'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import AntDesign from '@expo/vector-icons/AntDesign';
import { router } from 'expo-router';

const HomeSearch = () => {

  const {lastDestination, setLastDestination} = useLocationContext()

  const {address} = useProfileContext()

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

  // Function to get last destination to next page
  const handleLastDestinationPress = () => {
    // if (lastDestination) {
    //   router.push({
    //     pathname: '/screens/destinationsearch',
    //     params: { lastDestination },
    //   });
    // }
  };

  // Function to get Home address to next page
  const handleHomePress = () => {
    // if (lastDestination) {
    //   router.push({
    //     pathname: '/screens/destinationsearch',
    //     params: { address },
    //   });
    // }
  };

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
        {lastDestination && (
          <Pressable style={styles.row} onPress={handleLastDestinationPress}>
            <View style={styles.iconContainer}>
              <AntDesign name={'clockcircle'} size={16} color={'#535353'}/>
            </View>
            <Text style={styles.destinationText }>{lastDestination.length > 25 ? `${lastDestination.substring(0,30)}...` : lastDestination}</Text>
          </Pressable>
        )}

        {/* home destination */}
        {address && (
          <Pressable style={styles.row} onPress={handleHomePress}>
            <View style={[styles.iconContainer,{backgroundColor:'#04a835'}]}>
            <AntDesign name="home" size={16} color="#535353" />
            </View>
            <Text style={styles.destinationText }>{address.length > 25 ? `${address.substring(0,30)}...` : address}</Text>
          </Pressable>
        )}
    </View>
  )
}

export default HomeSearch