import { View, Text, TextInput,Pressable, Alert, ScrollView, Image, TouchableOpacity} from 'react-native'
import React from 'react'
import * as ImagePicker from 'expo-image-picker';
import styles from './styles'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { AntDesign } from '@expo/vector-icons';
import { useProfileContext } from '../../../providers/ProfileProvider';


const EditProfile = () => {

    const {firstName,setFirstName, lastName, setLastName, profilePic, setProfilePic, address, setAddress, phoneNumber, setPhoneNumber, errorMessage, onValidateInput,} = useProfileContext()

    const pickImage = async () => {
      // No permissions request is necessary for launching the image library
      let result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 1,
      });
  
      if (!result.canceled) {
        setProfilePic(result.assets[0].uri);
      }
    };
    
    // Navigation Function
    const handleSave = () => {
      if (onValidateInput()) {
          router.push('/profile'); // Navigate to the profile screen upon successful validation
      }
    };

    return (
    <ScrollView style={styles.container}>

      <Text style={styles.title}>Profile</Text>

      {/* Upload Profile Picture */}
      <View style={styles.profilePicContainer}>
        {profilePic && <Image source={{ uri: profilePic }} style={styles.img} />}
        <View style={styles.plusIconContainer}>
        <TouchableOpacity onPress={pickImage}>
          <AntDesign style={styles.plusIcon} name="pluscircle"  />
        </TouchableOpacity>
        </View>
      </View>
      {/* <TouchableOpacity onPress={pickImage}>
        <AntDesign style={styles.plusIcon} name="pluscircle" size={30} color="#03033b" />
      </TouchableOpacity> */}
        

      <TextInput 
      value={firstName}
      onChangeText={setFirstName}
      placeholder='Name / Company name'
      style={styles.input}
      />
      <TextInput 
      value={lastName}
      onChangeText={setLastName}
      placeholder='Surname (Optional)'
      style={styles.input}
      />

      <TextInput 
      value={address}
      onChangeText={setAddress}
      placeholder='Address'
      style={{...styles.input, color: '#04df04'}}
      />
    
      <TextInput
      value={phoneNumber}
      onChangeText={setPhoneNumber}
      placeholder='Phone Number'
      style={styles.input}
      keyboardType='numeric'
      />

      {/* Error Message */}
      <Text style={styles.error}>{errorMessage}</Text>
      
      <View style={styles.scrnBtns}>
          {/* <Link href={'/profile'} asChild> */}
              <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
              <Text style={styles.saveTxt}>Save</Text>
              </TouchableOpacity>
          {/* </Link> */}

          <Pressable onPress={()=>console.warn('sign out')} style={styles.signoutBtn}>
          <Text style={styles.signoutTxt}>Sign Out</Text>
          </Pressable>
      </View>
      
      
    </ScrollView>
  )
}

export default EditProfile;