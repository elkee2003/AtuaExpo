import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import React, {useState} from 'react';
import styles from './styles';
import CheckBox from '@react-native-community/checkbox';
import { Ionicons } from '@expo/vector-icons'; 
import { useForm, Controller } from 'react-hook-form';
import SocialSigninButtons from './SocialSigninButtons';
import { router } from 'expo-router';
// import { Auth } from 'aws-amplify'
import { signUp } from 'aws-amplify/auth';

const SignupCom = () => {

    const [loading, setLoading] = useState(false);
    const [toggleCheckBox, setToggleCheckBox] = useState(false); 

    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isPasswordRepeatVisible, setIsPasswordRepeatVisible] = useState(false);

    const {control, handleSubmit, formState:{errors}, getValues} = useForm()


    // Automatically assign a role (for user app example)
    const role = "user"; // Automatically set based on the app

    const onSignUp = async (data) => {
        setLoading(true);
        const { email, password } = data;
    
        try {
          // Register the user with additional custom attributes
        //   const userAttributes = {
        //     email: email,
        //     'custom:role': role // Automatically add the custom role attribute
        //   };
        // Old way:
        // const { courier} = await Auth.signUp({
        //     username: email,  // Using email as the username
        //     password,
        //     attributes: {
        //         email,
        //         'custom:role': role, // Automatically add the custom role attribute
        //       },
        //       autoSignIn: { enabled: true } // Automatically sign in after sign-up
        //     });

        const { isSignUpComplete, userId, nextStep } = await signUp({
            username: email,  // Using email as the username
            password,
            options: {
                userAttributes: {
                    email,
                    'custom:role': role, // Automatically add the custom role attribute
                },
                autoSignIn: true, // Automatically sign in after sign-up
            },
        });
          
          router.push({
            pathname: '/login/confirmemail', 
            params: { username: email } // Pass the username/email
          });

        } catch (error) {
          Alert.alert('Error', error.message);
        }
    
        setLoading(false);
    };
    
  return (

    <View showsVerticalScrollIndicator={false} style={styles.containerP}>

        {/* Header */}
        <View style={styles.titleCon}>
            <Text style={styles.title}>
                Create Account
            </Text>
        </View>

            {/* Input */}
        <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.inputSection}>
                {/* <Text style={styles.inputSub}>Username</Text>
                <TextInput
                    style={styles.input} 
                    value={username} 
                    onChangeText={setUsername} 
                    placeholder='Enter your Username'
                /> */}

                <Text style={styles.inputSub}>Email</Text>
                <Controller
                    name='email'
                    control={control}
                    defaultValue=''
                    rules={{
                        required:'Email is required',
                        pattern:{
                            value: /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/,
                            message: 'Invalid email format',
                        },
                    }}
                    render={({field:{value, onChange, onBlur}})=>(
                        <TextInput
                            style={styles.input}
                            value={value} 
                            onChangeText={onChange}
                            onBlur={onBlur}
                            autoCapitalize='none'
                            placeholder='Enter your Email' 
                        />
                    )}
                />
                {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}

                <Text style={styles.inputSub}>Password</Text>
                <Controller
                    name='password'
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
                    render={({field:{value, onChange, onBlur}})=>(
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.input}  
                                value={value} 
                                secureTextEntry={!isPasswordVisible}
                                onChangeText={onChange}
                                onBlur={onBlur}
                                autoCapitalize='none'
                                placeholder='Enter your Password' 
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
                {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}
                

                {/* Confirm Password */}
                <Text style={styles.inputSub}>Confirm Password</Text>
                <Controller
                    name='confirmPassword'
                    control={control}
                    defaultValue=''
                    rules={{
                        required: 'Please confirm your password',
                        validate: (value) => {
                        const password = getValues('password'); // Get password value
                        return value === password || 'Passwords do not match';
                        },
                    }}
                    render={({field:{value, onChange, onBlur}})=>(
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.input} 
                                value={value} 
                                secureTextEntry={!isPasswordRepeatVisible}
                                onChangeText={onChange}
                                onBlur={onBlur}
                                autoCapitalize='none'
                                placeholder='Please confirm your Password' 
                            />
                            <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setIsPasswordRepeatVisible(!isPasswordRepeatVisible)}
                            >
                                <Ionicons
                                name={isPasswordRepeatVisible ? 'eye' : 'eye-off'}
                                size={24}
                                color="grey"
                                />
                            </TouchableOpacity>
                        </View>
                    )}
                />
                {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword.message}</Text>}
                
            </View>

            {/* Policies */}
            <View style={styles.policyContainerSignUp}>
                <CheckBox
                    disabled={false}
                    value={toggleCheckBox}
                    onValueChange={(newValue) => setToggleCheckBox(newValue)}
                />
                <Text style={styles.policyTxt}>
                    I agree to the{' '}
                    <Text style={styles.policyLink} onPress={() => router.push('/screens/termsandconditions')}>
                        Terms of Service
                    </Text>{' '}
                    and{' '}
                    <Text style={styles.policyLink} onPress={() => router.push('/screens/privacypolicy')}>
                        Privacy Policy
                    </Text>
                </Text>
            </View>
            <TouchableOpacity 
                style={styles.btnCon} 
                onPress={handleSubmit(onSignUp)}
                disabled={!toggleCheckBox || loading}
            >
                { loading ?
                    (<Text style={styles.btnTxt}>Signing Up...</Text>)
                    :
                    (<Text style={styles.btnTxt}>Sign Up</Text>)
                }
            </TouchableOpacity>

            {/* Social Signins */}
            {/* <SocialSigninButtons/> */}

            <TouchableOpacity style={styles.secBtnCon} onPress={()=>router.push('/login')}>
                <Text style={styles.secBtnTxt}>Sign In</Text>
            </TouchableOpacity>
        </ScrollView>
    </View>
  )
}

export default SignupCom;