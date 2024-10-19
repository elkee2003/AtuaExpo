import { View, Text, FlatList, Image, TextInput, TouchableOpacity } from 'react-native';
import React,{useState} from 'react';
import styles from './styles';
import maxitypes from '../../../../assets/data/maxitypes'
import { router } from 'expo-router';

const MaxiTypes = () => {

    const [maxitype, setMaxitype] = useState(maxitypes);
    const [searchQuery, setSearchQuery] = useState('')

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Maxi Types</Text>

      <TextInput
        style={styles.searchBar}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder='Search...'
      />

      <FlatList
        showsVerticalScrollIndicator={false}
        data={maxitype}
        renderItem={({item})=>(
            <TouchableOpacity style={styles.row} onPress={()=>router.push(`/screens/searchresults/${item.id}`)}>
                <View style={styles.imgContainer}>
                    <Image source={{uri:item.image[0]}} style={styles.img}/>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.sub}>Name:</Text>
                    <Text style={styles.detailFirst}>{item.vehicleType}</Text>
                    <Text style={styles.sub}>Price:</Text>
                    <Text style={styles.detail}>₦
                    {parseInt(item.price).toLocaleString()}</Text>
                </View>
            </TouchableOpacity>
        )}
      />
    </View>
  )
}

export default MaxiTypes;