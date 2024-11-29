import { View, Text, Image, Alert, ScrollView} from 'react-native'
import React, {useState} from 'react'
import Logo from '../../assets/images/Atua.png'
import CustomInput from './customInput'
import CustomButton from './customButtons'
import SocialSigninButtons from './SocialSigninButtons/'
import { useForm, Controller } from 'react-hook-form';
import styles from './styles'
import { signIn } from 'aws-amplify/auth';

import { router } from 'expo-router'

const index = () => {

    const  { control, handleSubmit, formState:{errors} } = useForm()

    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    const onSignInPressed = async (data) =>{
        const { email, password } = data;

        if(loading){
            return;
        }

        setLoading(true);
        try {
            const { isSignedIn, nextStep } = await signIn({ username: email, password });
            // If sign-in is successful, navigate to the profile page
            router.push('/profile');

          } catch (error) {
            Alert.alert('Oops', error.message);
            console.log('Error signing in:', error);
            // Optionally handle sign-in failure (e.g., show an error message to the user)
          }
          setLoading(false);    
    };
    

    const onSignUpPressed = () =>{
        router.push('/login/signup')
    }

    const onForgotPassword = () =>{
        router.push('/login/forgotpassword')
    }

  return (
    <View style={styles.container}>

        {/* Logo */}
        <View style={styles.logoCon}>
            <Image source={Logo} style={styles.logo}/>
        </View>

        {/* Header */}
        <View style={styles.titleCon}>
            <Text style={styles.title}>
                Sign In (Client App)
            </Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
            {/* Email */}
            <CustomInput
                name='email' 
                control={control}
                rules={{
                    required: 'Email is required',
                    pattern: {
                      value: /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/,
                      message: 'Invalid email format',
                    },
                }}
                placeholder='Enter your Email'
                inputSub='Email'
            />

            {/* Password */}
            <CustomInput 
                name='password'
                control={control}
                isPasswordVisible={isPasswordVisible}
                setIsPasswordVisible={setIsPasswordVisible}
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
                placeholder='Enter your Password' 
                inputSub='Password'
                secureTextEntry={!isPasswordVisible}
            />
            

            {/* Policy */}
            <View style={styles.policyContainer}>
                <Text style={styles.policyTxt}>Kindly review the <Text style={styles.policyLink}onPress={()=>router.push('/policies')}>Terms of Use </Text>and <Text style={styles.policyLink}onPress={()=>router.push('/policies')}>Privacy Policy</Text> before going further.</Text>
            </View>

            {/* Buttons */}
            <CustomButton 
                text={loading ? 'Loading...' : 'Sign In'} 
                onPress={handleSubmit(onSignInPressed)}
            />

            {/* Social Signin Buttons */}
            {/* <SocialSigninButtons/> */}

            {/* Forgot Password & Create Account Btns */}
            <View style={styles.secBtnSection}>
                <CustomButton
                    text='Forgot Password?' 
                    onPress={onForgotPassword}
                    type='SECONDARY'
                />
                <CustomButton 
                    text='Create Account' 
                    onPress={onSignUpPressed}
                    type='SECONDARY'
                />
            </View>
        </ScrollView>
    </View>
  )
}

export default index