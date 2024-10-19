import { View, Text, TextInput, Alert, ScrollView, Image, TouchableOpacity} from 'react-native'
import React from 'react'
import * as ImagePicker from 'expo-image-picker';
import styles from './styles'
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router'
import { signOut } from 'aws-amplify/auth';
import { AntDesign } from '@expo/vector-icons';
import { useProfileContext } from '../../../providers/ProfileProvider';


const EditProfile = () => {


    const {firstName,setFirstName, lastName, setLastName, profilePic, setProfilePic, phoneNumber, setPhoneNumber, errorMessage, onValidateInput,} = useProfileContext()

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
    const goToAddressPage = () => {
      if (onValidateInput()) {
          router.push('/profile/address'); // Navigate to the profile screen upon successful validation
      }
    };


    async function handleSignOut() {
      try {
        const res = await signOut();
        console.log(res)
      } catch (error) {
        console.log('error signing out: ', error);
      }
    }
    
    const onSignout = ()=>{
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out? Click on YES, then refresh the App',
        [
          {
            text: "Cancel",
            style: "cancel",
            
          },
          {
            text: "Yes",
            onPress: () => handleSignOut(),
          },
        ],
        { cancelable: true }
      )
    };

    return (
    <View style={styles.container}>

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

      {/* Sign out button */}
      <TouchableOpacity style={styles.signoutBtn} onPress={onSignout}>
        <Text style={styles.signoutTxt}>Sign Out</Text>
      </TouchableOpacity>
        
      <ScrollView showsVerticalScrollIndicator={false}>
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
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        placeholder='Phone Number'
        style={styles.input}
        keyboardType='numeric'
        />

        {/* Error Message */}
        <Text style={styles.error}>{errorMessage}</Text>
      </ScrollView>
      
      <TouchableOpacity onPress={goToAddressPage} style={styles.nxtBtn}>
        <MaterialIcons name="navigate-next" style={styles.nxtBtnIcon} />
      </TouchableOpacity>
    </View>
  )
}

export default EditProfile;