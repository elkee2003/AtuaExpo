import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native'
import React from 'react'
import styles from './styles'
import { useOrderContext } from '@/providers/OrderProvider'
import deliveryMediums from '../../../assets/data/types'
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';

const AtuaTypes = ({
  selectedType, 
  setSelectedType, 
  calculatedPrice,
  setCalculatedPrice, 
  totalKm,
  totalMins,
  isPeakHour,
  isWeekend,
  isNightTime,
  isHoliday,
  // isLongDistance, 
  // isRushDelivery,

  // isHighTrafficArea,
  // isHeavyItem,
  // isFragileItem,
}) => {

  const {setPrice, setTransportationType} = useOrderContext()

  const getImage=(medium)=>{
      if (medium?.type === 'Micro X'){
          return require('../../../assets/atuaImages/Walk.png')
      }
      if (medium?.type === 'Moto X'){
          return require('../../../assets/atuaImages/Bike.jpg')
      }
      if (medium?.type === 'Maxi'){
          return require('../../../assets/atuaImages/UberXL.jpeg')
      }
      if (medium?.type === 'GROUP'){
          return require('../../../assets/atuaImages/Deliverybicycle.png')
      }
      return require('../../../assets/atuaImages/UberXL.jpeg');
  }

  // Function to show the alert based on the medium type
const showInfoAlert = (type) => {
  if (type === 'Moto X') {
      Alert.alert('Moto X', 'Moto Express. This transportation method is suitable for faster, mid-sized deliveries that require speed and distance. This option includes Motorcycles, Mopeds, Car.');
    } else if (type === 'Micro X') {
      Alert.alert('Micro X', 'Micro Express. This transportation method option includes eco-friendly transport methods such as Bicycles, Scooters, Skates for quick, short-distance deliveries.');
    } else if (type === 'Maxi') {
      Alert.alert('Maxi', 'This transportation method is best for large or bulky items that need spacious transport. This option includes Vans, Moving Trucks, Cooling Van, Large Cargo vehicles.');
    } else if (type === 'Moto Batch') {
      Alert.alert('Moto Batch', 'Moto Batch. This transportation method is suitable for faster, mid-sized deliveries that require speed and distance. This option includes Motorcycles, Mopeds, Car.');
    } else if (type === 'Micro Batch') {
      Alert.alert('Micro Batch', 'This transportation method option includes eco-friendly transport methods such as Bicycles, Scooters, Skates for quick, short-distance deliveries.');
    }
  };
  
  const onConfirm = (medium) =>{
    setSelectedType(medium?.type)
    setTransportationType(medium.type)
    console.log(medium.type)
    const calculatedCost = calculatePrice(medium.type, totalKm);

    if(totalKm > 0){

      // Setting the price from orderContext
      setPrice(calculatedCost)

      if (medium.type === 'Maxi') {
        router.push('/screens/searchresults/maxitypes');
      }else {
        router.push('/screens/checkout');
      }
    }else{
      Alert.alert('Patience', 'Calculating Price...')
    }
  };

  const calculatePrice = (type, distance,) => {
    const serviceFee = 300; // service fee added to all calculations
    
    // Flat rates for distances less than 3km
    if (distance <= 2.7) {
      if (type === 'Micro X') return 300 + serviceFee; // 300 flat rate + 300 service fee
        if (type === 'BIKE') return 500 + serviceFee; // 500 flat rate + 300 service fee
        // if (type === 'Maxi') return 700 + serviceFee; // 700 flat rate + 300 service fee
        if (type === 'GROUP') return 250 + serviceFee; // 250 flat rate + 300 service fee
    } 

    let pricePerKm;
    let baseCharge;

     // Distance ranges with base charges and per km rates
    if (distance <= 5){
      // Base charge and price per km for distances between 3.01km and 5km
      baseCharge = 50; // Mild base charge for this range
      if (type === 'Micro X') pricePerKm = 185;
      if (type === 'Moto X') pricePerKm = 220;
      // if (type === 'Maxi') pricePerKm = 250;
      if (type === 'GROUP') pricePerKm = 170;
    } else if (distance <= 10) {
      // Base charge and price per km for distances between 5.01km and 10km
      baseCharge = 75; // Mild base charge for this range
      if (type === 'Micro X') pricePerKm = 180;
      if (type === 'Moto X') pricePerKm = 210;
      // if (type === 'Maxi') pricePerKm = 240;
      if (type === 'GROUP') pricePerKm = 150;
    } else if (distance <= 15) {
      // Base charge and price per km for distances between 10.01km and 15km
      baseCharge = 100; // Mild base charge for this range
      if (type === 'Micro X') pricePerKm = 175;
      if (type === 'Moto X') pricePerKm = 200;
      // if (type === 'Maxi') pricePerKm = 230;
      if (type === 'GROUP') pricePerKm = 140;
    }else if (distance <= 20) {
      baseCharge = 125; // Base charge for this range
      if (type === 'Micro X') pricePerKm = 170;
      if (type === 'Moto X') pricePerKm = 190;
      // if (type === 'Maxi') pricePerKm = 220;
      if (type === 'GROUP') pricePerKm = 130;
    } else if (distance <= 25) {
      baseCharge = 150; // Base charge for this range
      if (type === 'Micro X') pricePerKm = 165;
      if (type === 'Moto X') pricePerKm = 185;
      // if (type === 'Maxi') pricePerKm = 210;
      if (type === 'GROUP') pricePerKm = 125;
    } else if (distance <= 30) {
      baseCharge = 175; // Base charge for this range
      if (type === 'Micro X') pricePerKm = 160;
      if (type === 'Moto X') pricePerKm = 180;
      // if (type === 'Maxi') pricePerKm = 200;
      if (type === 'GROUP') pricePerKm = 120;
    } else if (distance > 30) {
      baseCharge = 250; // Higher base charge for 40km and above
      if (type === 'Micro X') pricePerKm = 150;
      if (type === 'Moto X') pricePerKm = 175;
      // if (type === 'Maxi') pricePerKm = 190;
      if (type === 'GROUP') pricePerKm = 110;
    }
  
    // Calculate the price by multiplying the distance by pricePerKm, adding the base charge and service fee
    let estimatedPrice = baseCharge + (distance * pricePerKm) + serviceFee;


    // Let's say you want to add the following surcharges:
    // Peak Hours Surcharge: 20% increase during peak hours (e.g., 5 PM to 8 PM).
    // Weekend Surcharge: Fixed NGN 100 extra for weekend deliveries.
    // Location Surcharge: NGN 50 extra for certain high-traffic areas.
    
    // Apply surcharges
    if (isPeakHour) {
      estimatedPrice *= 1.2; // 20% surcharge for peak hours
    }

    if (isNightTime) {
      estimatedPrice += 150; // NGN 150 surcharge for night deliveries
    }

    if (isWeekend) {
      estimatedPrice += 100; // NGN 100 surcharge for weekends
    }

    if (isHoliday) {
      estimatedPrice += 200; // NGN 200 surcharge for deliveries on holidays
    }

    // 4. Long-Distance Surcharge (if distance > 25 km)
    if ( distance > 45) {
      estimatedPrice += 250; 
    }
    // if (isHighTrafficArea) {
    //   estimatedPrice += 50; // NGN 50 surcharge for high-traffic areas
    // }
    // if (isHeavyItem) {
    //   estimatedPrice += 300; // NGN 300 surcharge for heavy items
    // }
  
    // // 9. Fragile Item Surcharge
    // if (isFragileItem) {
    //   estimatedPrice += 100; // NGN 100 surcharge for fragile items
    // }

    return estimatedPrice.toFixed(2); // Rounds the price to 2 decimal places
  };

  // Filter out BICYCLE if distance > 13km and BIKE if distance > 30km (two different distances)
  // const filteredDeliveryMediums = deliveryMediums.filter(medium => {
  //   return !((medium.type === 'BICYCLE' && totalKm > 13) || (medium.type === 'BIKE' && totalKm > 30));
  // });

  // Filter out BICYCLE and BIKE options if distance > 13km (same distance)
  // const filteredDeliveryMediums = deliveryMediums.filter(medium => {
  //   return !( (medium.type === 'BICYCLE' || medium.type === 'BIKE') && totalKm > 13);
  // });

  // Filter out BICYCLE option if distance > 13km
  const filteredDeliveryMediums = deliveryMediums.filter(medium => {
    return !(medium.type === 'Micro X' && totalKm > 13);
  });

  return (
    <ScrollView>
      {/* note it was previous deliverymediums.map() */}
      {filteredDeliveryMediums.map(medium =>{
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
              <View style={styles.typeInfoRow}>
                <Text style={styles.type}>
                    {medium.type}
                </Text>
                <TouchableOpacity onPress={() => showInfoAlert(medium.type)}>
                  <Ionicons name={'information-circle-outline'} style={styles.infoIcon} />
                </TouchableOpacity>
              </View>
              <Text style={styles.time}>{totalKm} km | {totalMins} mins</Text>
            </View>

            {/* Price */}
            <View style={styles.rightContainer}>
              <Ionicons name={'pricetag'} size={18} color={'#42d742'}/>
              {totalKm > 0 ? (
                // Hide price for Maxi type
                medium.type !== 'Maxi' ? (
                  <Text style={styles.price}>est. ₦{calculatedCost}</Text>
                ) : null
              ) : (
                <ActivityIndicator size={'small'}/>
              )}
            </View>
          </TouchableOpacity>
        );
      
      })}
      {/* <TouchableOpacity style={styles.confirmBtn}>
        <Text style={styles.confirmTxt}>Confirm</Text>
      </TouchableOpacity> */}
    </ScrollView>
  )
}

export default AtuaTypes