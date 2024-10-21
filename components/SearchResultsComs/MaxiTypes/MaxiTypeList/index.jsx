import { View, Text, FlatList, Image, TextInput, TouchableOpacity } from 'react-native';
import React,{useEffect, useState} from 'react';
import styles from './styles';
import maxitypess from '../../../../assets/data/maxitypes'
import { router } from 'expo-router';
import { DataStore } from 'aws-amplify/datastore';
import {Courier} from '../../../../src/models'

const MaxiTypes = () => {

    const [searchQuery, setSearchQuery] = useState('')  
    const [maxitypes, setMaxitypes] = useState(maxitypess);
    const [filteredData, setFilteredData] = useState([]);

    const handleSearch = (query) => {
      setSearchQuery(query);

      // Wait until housePosts is populated before attempting to filter
      if (maxitypes.length === 0) {
        return; // Exit if housePosts is not yet populated
      }

      // if query is empty, show all data
      if(!query){
        setFilteredData([])
      }else{
        const lowercasedQuery = query.toLowerCase();

        const filtered = maxitypes.filter(item => {
          const matchesMaxiVehicleName = item?.vehicleType?.toLowerCase().includes(lowercasedQuery);

          return matchesMaxiVehicleName ;
        });
        setFilteredData(filtered)
      }
    }

    const fetchMaxiType = async () => {
      try{
        const realtors = await DataStore.query(Courier);

        // will write the rest of the code later
      }catch(error){
        console.error('This is the error from searchbar:', error)
      }
    };

    // useEffect(()=>{
    //   fetchMaxiType()
    // },[])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Maxi Types</Text>

      <TextInput
        style={styles.searchBar}
        value={searchQuery}
        onChangeText={handleSearch}
        placeholder='Search...'
      />

      <FlatList
        showsVerticalScrollIndicator={false}
        data={maxitypes}
        renderItem={({item})=>(
            <TouchableOpacity style={styles.row} onPress={()=>router.push(`/screens/searchresults/${item.id}`)}>
                <View style={styles.imgContainer}>
                    <Image source={{uri:item.image[0]}} style={styles.img}/>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.sub}>
                      Name:
                    </Text>
                    <Text style={styles.detailFirst}>
                      {item.vehicleType}
                    </Text>

                    <Text style={styles.sub}>
                      Price:
                    </Text>
                    <Text style={styles.detail}>
                      ₦{parseInt(item.price).toLocaleString()}
                    </Text>
                </View>
            </TouchableOpacity>
        )}
      />
    </View>
  )
}

export default MaxiTypes;