import { View, Text, TouchableOpacity, Image, FlatList, ScrollView, Dimensions} from 'react-native'
import React from 'react'
import PaymentComponent from '../MaxiPayment';
import styles from './styles'

const { width } = Dimensions.get('window');

const DetailedPost = ({maxitype}) => {
    
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Detailed Transportation</Text>

      {/* Images */}
      
        <FlatList
          horizontal
          pagingEnabled
          snapToInterval={width}
          snapToAlignment="center"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item,index)=>index.toString()}
          data={maxitype.image}
          renderItem={({item})=>(
            <View style={styles.imgConatiner}>
              <Image source={{uri: item}} style={styles.img}/>
            </View>
          )}
        />
      
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollSec}>
        <Text style={styles.subHeading}>
          Type of Vehicle:
        </Text>
        <Text style={styles.detail}>
          {maxitype.vehicleType}
        </Text>

        <Text style={styles.subHeading}>
          Model:
        </Text>
        <Text style={styles.detail}>
          {maxitype.model}
        </Text>

        {/* <Text style={styles.subHeading}>
          Plate Number:
        </Text>
        <Text style={styles.detail}>
          {maxitype.plateNumber}
        </Text> */}

        <View>
          <Text style={styles.subHeading}>Price:</Text>
          <Text style={styles.detail}>{maxitype.price}</Text>
        </View>
      </ScrollView>

      {/* Btn */}

      <PaymentComponent/>
      {/* <TouchableOpacity style={styles.btnContainer} onPress={()=>console.warn('order')}>
        <Text style={styles.btnTxt}>Paynow</Text>
      </TouchableOpacity> */}
    </View>
  )
}

export default DetailedPost;