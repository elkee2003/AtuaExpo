import { View, Text } from 'react-native';
import React from 'react';
import DetailedPost from '../../../components/SearchResultsComs/MaxiTypes/DetailedPost';
import { useLocalSearchParams } from 'expo-router';
import maxitypes from '../../../assets/data/maxitypes';

const DetailedTransportPost = () => {

    const {id}= useLocalSearchParams()
    const maxitype = maxitypes.find(type => type.id === id)

    if (!maxitype) {
      return <Text style={{fontSize:18, fontWeight:'bold', textAlign:'center', color:'#9b9999',}}>Item not found</Text>;
    }

  return (
    <View style={{flex:1}}>
      <DetailedPost maxitype={maxitype}/>
    </View>
  )
}

export default DetailedTransportPost;