import { View, Text, TextInput, Alert, TouchableOpacity } from 'react-native'
import React, {useState} from 'react'
import styles from './styles'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'; 
import {useForm, Controller} from 'react-hook-form';
import { confirmResetPassword } from 'aws-amplify/auth';

const ConfirmCodeCom = () => {

    const [isPasswordVisible, setIsPasswordVisible] = useState(false)
    const [loading, setLoading] = useState(false)

    const { email } = useLocalSearchParams(); 

    const { control, handleSubmit, formState:{errors}} = useForm();

    // Function to handle confirm reset password
    async function handleConfirmResetPassword({ username, confirmationCode, newPassword }) {

        if (loading){
            return;
        }
        setLoading(true)

        try {
            await confirmResetPassword({ username, confirmationCode, newPassword });
            Alert.alert('Success', 'Password has been reset successfully!');
            router.push('/login'); // Navigate to login screen after successful reset
        } catch (error) {
            // Show error if unable to reset password
            Alert.alert('Oops', error.message);
            console.log('Error confirming reset password:', error);
        }
        setLoading(false)
    }

    // Function to handle form submission
    const onSubmit = (data) => {
        const { code, newPassword } = data;
        // Call handleConfirmResetPassword with email, code, and newPassword
        handleConfirmResetPassword({
            username: email,
            confirmationCode: code,
            newPassword,
        });
    };

  return (
    <View style={styles.container}>

        {/* Header */}
        <View style={styles.titleCon}>
            <Text style={styles.title}>
                Reset Password
            </Text>
        </View>

        {/* Input */}
        <View style={styles.inputSection}>
        <Text style={styles.inputSub}>Confirmation Code</Text>
        <Controller
            name='code'
            control={control}
            defaultValue=''
            rules={{
                required:'Code is required'
            }}
            render={({ field: {value, onChange, onBlur }})=>(
                <TextInput
                    style={[styles.input, errors.code && styles.errorBorder]}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder='Enter code sent to your email'
                />
            )}
        />
        {errors.code && <Text style={styles.errorText}>{errors.code.message}</Text>}

        {/* New Password */}
        <Text style={styles.inputSub}>
            New Password
        </Text>
        <Controller
            name= 'newPassword'
            control={control}
            defaultValue=''
            rules={{
                required:'Password is required',
                minLength:{
                    value:8,
                    message:'Password must be at least 8 characters long.'
                },
                validate: (value) => {
                    // Check if the password contains a number
                    const hasNumber = /\d/.test(value);
                    if (!hasNumber) {
                      return 'Password must include at least one number';
                    }
                    return true; // Return true if validation passes
                },
            }}
            render={({field:{onChange,onBlur, value}})=>(
                <View style={styles.passwordContainer}>
                    <TextInput
                        style={[styles.input, errors.newPassword && styles.errorBorder]}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder='Enter your new password'
                        autoCapitalize='none'
                        secureTextEntry={!isPasswordVisible}
                    />
                    <TouchableOpacity 
                        style={styles.eyeIcon}
                        onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                    >
                        <Ionicons
                        name={isPasswordVisible ? 'eye' : 'eye-off'}
                        size={24}
                        color="grey"
                        />
                    </TouchableOpacity>
                </View>
            )}
        />
        {errors.newPassword && <Text style={styles.errorText}>{errors.newPassword.message}</Text>}
        </View>

        <TouchableOpacity 
            style={styles.btnCon}
            onPress={handleSubmit(onSubmit)}
        >
            <Text style={styles.btnTxt}>{loading ? 'Submitting...': 'Submit'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secBtnCon} onPress={()=>router.push('/login')}>
            <Text style={styles.secBtnTxt}>Back to Sign In</Text>
        </TouchableOpacity>
    </View>
  )
}

export default ConfirmCodeCom;