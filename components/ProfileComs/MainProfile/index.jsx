import { View, Text, Image, TouchableOpacity, Alert, ScrollView } from 'react-native'
import React, {useState, useEffect} from 'react'
import { useProfileContext } from '../../../providers/ProfileProvider'
import { Ionicons } from '@expo/vector-icons'
import Placeholder from '../../../assets/images/placeholder.png'
import {useAuthContext} from '@/providers/AuthProvider';
import { DataStore } from 'aws-amplify/datastore';
import {User} from '@/src/models';
import { getUrl } from 'aws-amplify/storage';
import styles from './styles'
import { router } from 'expo-router'
import { signOut } from 'aws-amplify/auth'

const MainProfile = () => {

    const {firstName, lastName, address, phoneNumber, setProfilePic, profilePic} = useProfileContext()

    const {dbUser} = useAuthContext();

    const [loading, setLoading]= useState(true);

    // Fetch signed URL for profile picture
    const fetchImageUrl = async () => {
      setLoading(true);

      if (!dbUser?.profilePic) {
        // If profilePic is not available, use the placeholder
        setProfilePic(null);
        setLoading(false);
        return;
      }
      
      try {
        const result = await getUrl({
          path: dbUser.profilePic,
          options: {
            validateObjectExistence: true, 
            expiresIn: null, // No expiration limit
          },
        });

        if (result.url) {
          setProfilePic(result?.url.toString());
        }else {
          setProfilePic(null); // Fallback to null if no URL is returned
        }
      } catch (error) {
        console.log('Error fetching profile pic URL:', error);
        setProfilePic(null); 
      }finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      if (!dbUser?.profilePic || dbUser.profilePic.trim() === "") {
        return;
      }
  
      fetchImageUrl();
  
      const subscription = DataStore.observe(User).subscribe(({opType})=>{
        if(opType === 'INSERT' || opType === 'UPDATE' || opType === 'DELETE'){
          fetchImageUrl();
        }
      });
  
      return () => subscription.unsubscribe();
    }, [dbUser.profilePic]);

    async function handleSignOut() {
        try {
            await signOut();
        } catch (error) {
            console.log('error signing out: ', error);
        }
    }

    const onSignout = ()=>{
        Alert.alert(
          'Sign Out',
          'Are you sure you want to sign out?',
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
    }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      {/* Back Button */}
      <TouchableOpacity onPress={()=>router.back()} style={styles.bckBtnCon}>
            <Ionicons name={'arrow-back'} style={styles.bckBtnIcon}/>
      </TouchableOpacity>

      {/* Sign out button */}
      <TouchableOpacity style={styles.signoutBtn} onPress={onSignout}>
        <Text style={styles.signoutTxt}>Sign Out</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.centerCon} showsVerticalScrollIndicator={false}>

        {/* Profile Picture */}
        <View style={styles.profilePicContainer}>
          {loading || !profilePic  ? (
            <Image 
              source={Placeholder} 
              style={styles.img}
            /> // Show placeholder while loading
          ) : (
            <Image 
              source={{ uri: profilePic }} 
              style={styles.img} 
              onError={() => setProfilePic(null)}
              width={50}
              height={50} 
            />
          )}
        </View>

        {/* Relevant Info Section */}
        <View>
            <Text style={styles.details}>{firstName}</Text>
            <Text style={styles.details}>{phoneNumber}</Text>
            <Text style={styles.details}>{address}</Text>
        </View>

        {/* Button Section */}
        <View>
            <View style={styles.mainBtnsCard}>
                <TouchableOpacity style={styles.viewInfo} onPress={()=>router.push('/profile/reviewinfo')}>
                    <Text style={styles.viewInfoText}>View Info</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.editProfile} onPress={()=>router.push('/profile/editprofile')}>
                    <Text style={styles.editProfileTxt}>Edit Profile</Text>
                </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

export default MainProfile