import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native'
import React from 'react'
import styles from './styles'
import deliveryMediums from '../../../assets/data/types'
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';

const AtuaTypes = ({
  selectedType, 
  setSelectedType, 
  calculatedPrice,
  setCalculatedPrice, 
  totalKm,
  totalMins
}) => {

  const getImage=(medium)=>{
      if (medium?.type === 'BICYCLE'){
          return require('../../../assets/atuaImages/Walk.png')
      }
      if (medium?.type === 'BIKE'){
          return require('../../../assets/atuaImages/Bike.jpg')
      }
      if (medium?.type === 'CAR'){
          return require('../../../assets/atuaImages/UberXL.jpeg')
      }
      return require('../../../assets/atuaImages/UberXL.jpeg');
  }

  const onConfirm = (medium) =>{
    setSelectedType(medium?.type)
    // router.push('/screens/revieworder')
    console.log(medium.type)
  }

  const calculatePrice = (type, distance) => {
    const baseFare = 300; // Base fare added to all calculations
    
    let pricePerKm;
  
    if (distance <= 1) {
      // Fixed price for 1km or less
      if (type === 'BICYCLE') return 300;
      if (type === 'BIKE') return 700;
      if (type === 'CAR') return 1000;
      if (type === 'GROUP') return 200;
    } else if (distance <= 5){
      // Price per km for distances between 2km and 5km
      if (type === 'BICYCLE') pricePerKm = 350;
      if (type === 'BIKE') pricePerKm = 500;
      if (type === 'CAR') pricePerKm = 700;
      if (type === 'GROUP') pricePerKm = 300;
    } else if (distance <= 10) {
      // Price per km for distances between 6km and 10km
      if (type === 'BICYCLE') pricePerKm = 400;
      if (type === 'BIKE') pricePerKm = 700;
      if (type === 'CAR') pricePerKm = 900;
      if (type === 'GROUP') pricePerKm = 300;
    } else if (distance <= 15) {
      // Price per km for distances between 7.1km and 15km
      if (type === 'BICYCLE') pricePerKm = 370;
      if (type === 'BIKE') pricePerKm = 650;
      if (type === 'CAR') pricePerKm = 850;
      if (type === 'GROUP') pricePerKm = 300;
    }
  
    // Calculate the price by multiplying the distance by pricePerKm and adding the base fare
    const estimatedPrice = baseFare + (distance * pricePerKm);
    return estimatedPrice.toFixed(2); // Rounds the price to 2 decimal places
  };

  return (
    <ScrollView>
      {deliveryMediums.map(medium =>{
        const calculatedCost = calculatePrice(medium.type, totalKm);
        return(
          <TouchableOpacity
          onPress={()=>onConfirm(medium)} 
          key={medium.id} 
          style={[
            styles.container,
            selectedType === medium.type && styles.selectedContainer // Properly applying the selected style
          ]}>
            
            {/* image */}
            <Image style={styles.image} source={getImage(medium)}/>

            {/* Middle Container with AtuaMedium and duration */}
            <View style={styles.middleContainer}>
              <Text style={styles.type}>
                  {medium.type} {''}
                  <Ionicons name={'person'} size={17}/>
                  3
              </Text>
              <Text style={styles.time}>{totalKm} km | {totalMins} mins</Text>
            </View>

            {/* Price */}
            <View style={styles.rightContainer}>
              <Ionicons name={'pricetag'} size={18} color={'#42d742'}/>
              <Text style={styles.price}>est. ₦{calculatedCost}</Text>
            </View>
          </TouchableOpacity>
        );
      
      })}
      <TouchableOpacity style={styles.confirmBtn}>
        <Text style={styles.confirmTxt}>Confirm</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

export default AtuaTypes