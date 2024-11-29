import { View, Text, Image, ScrollView, TouchableOpacity, Alert } from 'react-native';
import React, {useState} from 'react';
import * as Crypto from 'expo-crypto';
import * as ImageManipulator from 'expo-image-manipulator';
import {useProfileContext} from '../../../providers/ProfileProvider'
import { useAuthContext } from '../../../providers/AuthProvider';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import styles from './styles'
import { router } from 'expo-router';
import { DataStore } from 'aws-amplify/datastore';
import {User} from '../../../src/models';
import { uploadData, remove } from 'aws-amplify/storage';

const ReviewUserCom = () => {

    const {firstName, lastName, setProfilePic, profilePic,  exactAddress, address, lat, lng, phoneNumber,} = useProfileContext()

    const {dbUser, setDbUser, sub} = useAuthContext()

    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    async function uploadImage() {
        try {

            // Step 1: Delete the previous profile photo if it exists
            if (dbUser?.profilePic) {
                console.log("Deleting previous profile photo:", dbUser.profilePic);
                await remove({ path: dbUser.profilePic });
            }

            // Step 2: Process and upload the new profile photo
            const manipulatedImage = await ImageManipulator.manipulateAsync(
                profilePic,
                [{ resize: { width: 800 } }],  // Adjust width as needed
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG } // Compress quality between 0 and 1
            );
            const response = await fetch(manipulatedImage.uri);
            const blob = await response.blob();

            // Generate a unique file key
            const fileKey = `public/profilePhoto/${sub}/${Crypto.randomUUID()}.jpg`; // New path format

            // Upload the new image to S3
            const result = await uploadData({
                path: fileKey,
                data: blob,
                options:{
                    contentType:'image/jpeg', // contentType is optional
                    onProgress:({ transferredBytes, totalBytes }) => {
                        if(totalBytes){
                            const progress = Math.round((transferredBytes / totalBytes) * 100);
                            setUploadProgress(progress); // Update upload progress
                            console.log(`Upload progress: ${progress}%`);
                        }
                    }
                }
            }).result

            return result.path;  // Updated to return `path`
            } catch (err) {
            console.log('Error uploading file:', err);
            }
    }

    // Function to delete profile picture from S3 and DataStore
    const deleteProfilePic = async () => {
        if (!dbUser?.profilePic) return;

        setUploading(true);
        try {
            // Use the full S3 path as the identifier
            const filePath = dbUser.profilePic;

            await remove({ path: filePath }); // Pass the full path as `path`

            // Update user in DataStore by setting profilePic to null
            const updatedUser = await DataStore.save(User.copyOf(dbUser, (updated) => {
                updated.profilePic = null;
            }));

            setDbUser(updatedUser);
            Alert.alert('Profile Picture Removed', 'You have successfully removed your profile picture');
            setProfilePic(null);
        } catch (error) {
            Alert.alert('Error', 'Failed to remove profile picture');
            console.log('Error removing profile picture:', error);
        } finally {
            setUploading(false);
        }
    };

    // Function to create and update courier
    const createUser = async () =>{
        if (uploading) return;
        setUploading(true);

        try{
            const uploadedImagePath = await uploadImage();  // Upload image first

            const user = await DataStore.save(new User({
                profilePic: uploadedImagePath,
                firstName, lastName, exactAddress, address, phoneNumber, 
                lat: parseFloat(lat), 
                lng: parseFloat(lng),
                sub
            }))
            setDbUser(user)
        }catch(e){
            Alert.alert('Error', e.message)
        }
    };

    const updateUser = async () =>{
        if (uploading) return;
        setUploading(true);

        try{
            const uploadedImagePath = await uploadImage();  // Upload image first

            const user = await DataStore.save(User.copyOf(dbUser, (updated)=>{
                updated.firstName = firstName;
                updated.lastName = lastName;
                updated.profilePic = uploadedImagePath;
                updated.exactAddress = exactAddress;
                updated.address = address;
                updated.phoneNumber = phoneNumber
                updated.lat = parseFloat(lat);
                updated.lng = parseFloat(lng);
            }))
            setDbUser(user)
        }catch(e){
            Alert.alert('Error', e.message)
        }
    };

    const handleSave = async () => {
        if(dbUser){
            await updateUser()
            router.push('/profile')

            setTimeout(() => {
                router.push('/home');
            }, 1000);
        }else {
            await createUser ()
            router.push('/profile')

            setTimeout(() => {
                router.push('/home');
            }, 1000);
        }
    }

  return (
    <View style={styles.container}>
        <Text style={styles.title}>Review Profile</Text>

        {/* Back Button */}
        <TouchableOpacity onPress={()=>router.back()} style={styles.bckBtnCon}>
                <Ionicons name={'arrow-back'} style={styles.bckBtnIcon}/>
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false}>

            {
                profilePic && ( 
                    <>
                        <View style={styles.profilePicContainer}>
                            <Image source={{ uri: profilePic }} style={styles.img} />
                        </View>

                        <TouchableOpacity 
                            style={styles.removeButtonContainer}
                            disabled={uploading}
                            onPress={deleteProfilePic}
                        >
                            <MaterialIcons name="cancel" style={styles.removebtn}/>
                        </TouchableOpacity>
                    </>
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
        <TouchableOpacity 
            style={styles.saveBtn}
            disabled={uploading} 
            onPress={handleSave}
        >
            <Text style={styles.saveBtnTxt}>
                {uploading ? `Saving... ${uploadProgress}%` : 'Save'}
            </Text>
        </TouchableOpacity>
    </View>
  )
}

export default ReviewUserCom;