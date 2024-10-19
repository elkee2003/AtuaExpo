import { View, Text, TextInput, Alert, TouchableOpacity } from 'react-native'
import React, {useState} from 'react'
import styles from './styles'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form';
import { resetPassword } from 'aws-amplify/auth';

const ForgotPasswordCom = () => {

    // const [email, setEmail] = useState('')
    const {control, handleSubmit, formState:{errors} } = useForm()
    const [loading, setLoading] = useState(false)

    // Function to handle form submission
    const onSubmit = async (data) => {
        const {email} = data;
        
        if(loading){
            return;
        }
        setLoading(true)

        try{
            const response = await resetPassword({ username: email });

            Alert.alert('Success', 'Code has been sent to your email')
            router.push({
                pathname: '/login/confirmcode',
                params: { email }, // Pass the email to the next screen for confirmation
            });
        }catch(e){
            Alert.alert('Error', e.message);
            console.log('Error sending password reset code:', e)
        }
        setLoading(false)
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
        <Text style={styles.inputSub}>Enter Your Email</Text>
        <Controller
            name='email'
            control={control}
            defaultValue=''
            rules={{
                required:'Email is required',
                pattern: {
                    value: /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/,
                    message: 'Invalid email format',
                },
            }}
            render={({field: {value,onChange, onBlur}})=>(
                <TextInput
                    style={[styles.input, errors.email && styles.errorBorder]}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder='Enter your email'
                />
            )}
        />
        {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}
        </View>

        <TouchableOpacity 
            style={styles.btnCon}
            onPress={handleSubmit(onSubmit)}
        >
            <Text style={styles.btnTxt}>{loading ? 'Sending...' : 'Send code'}</Text>
        </TouchableOpacity>

        <View style={styles.secBtnSection}>
            {/* Resend Code */}
            {/* <TouchableOpacity style={styles.secBtnCon} onPress={()=> console.warn('Resend Code')}>
                    <Text style={styles.secBtnTxt}>Resend code</Text>
            </TouchableOpacity> */}

            {/* Back to Sign In page */}
            <TouchableOpacity style={styles.secBtnCon} onPress={()=>router.push('/login')}>
                <Text style={styles.secBtnTxt}>
                    Back to Sign In
                </Text>
            </TouchableOpacity>
        </View>
    </View>
  )
}

export default ForgotPasswordCom;