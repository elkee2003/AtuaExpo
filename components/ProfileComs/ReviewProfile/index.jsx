import { View, Text, Image, ScrollView, TouchableOpacity } from 'react-native'
import React from 'react'
import { useProfileContext } from '../../../providers/ProfileProvider'
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import styles from './styles'
import { router } from 'expo-router';


const ReviewUser = () => {

  const {
    firstName, lastName, profilePic, exactAddress, address, phoneNumber, 
  } = useProfileContext()

  // Navigation Function
  const goToProfile = () => {
    router.push('/profile'); 
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Review Profile</Text>

      {/* Back Button */}
      <TouchableOpacity onPress={()=>router.back()} style={styles.bckBtnCon}>
                <Ionicons name={'arrow-back'} style={styles.bckBtnIcon}/>
      </TouchableOpacity>

      <TouchableOpacity style={styles.editBtn} onPress={()=>router.push('/profile/editprofile')}>
        <Text style={styles.editBtnTxt}>Edit</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>

        {profilePic && (
            <View style={styles.profilePicContainer}>
              <Image source={{ uri: profilePic }} style={styles.img} />
            </View>
          )
        }
        <Text style={styles.subHeader}>First Name:</Text>
        <Text style={styles.inputReview}>{firstName}</Text>

        <Text style={styles.subHeader}>Last Name:</Text>
        <Text style={styles.inputReview}>{lastName}</Text>
        <Text style={styles.subHeader}>Inputted Address:</Text>
        <Text style={styles.inputReview}>{exactAddress}</Text>
        <Text style={styles.subHeader}>Selected Address:</Text>
        <Text style={styles.inputReview}>{address}</Text>
        <Text style={styles.subHeader}>Phone Number:</Text>
        <Text style={styles.inputReviewLast}>{phoneNumber}</Text>
      </ScrollView>
      {/* Button */}
      <View>
          <TouchableOpacity onPress={goToProfile} style={styles.doneBtn}>
              <Text style={styles.doneTxt}>Done</Text>
          </TouchableOpacity>
      </View>
    </View>
  )
}

export default ReviewUser;