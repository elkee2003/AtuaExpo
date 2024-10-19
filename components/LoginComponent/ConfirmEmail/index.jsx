import { View, Text, TextInput, Alert, TouchableOpacity } from 'react-native'
import React, {useState} from 'react'
import styles from './styles'
import { useForm, Controller } from 'react-hook-form';
import { router, useLocalSearchParams } from 'expo-router'
import { confirmSignUp,  resendSignUpCode} from 'aws-amplify/auth';

const ConfirmEmailCom = () => {

    const [loading, setLoading] = useState(false)
    const [loadingCode, setLoadingCode] = useState(false)

    const { username } = useLocalSearchParams();

    const {control, handleSubmit, formState:{errors}} = useForm();

    // Function to handle form submission of code
    const onSubmit = async (data) => {
        const { confirmationCode } = data;

        if(loading){
            return;
        }

        setLoading(true);
        
        try{
            // Call confirmSignUp with username and code
            const response = await confirmSignUp({username, confirmationCode});

            Alert.alert('Success', 'You signed up successfully!');

            router.push('/login');
        }catch(error){
            // Log the error for debugging
            Alert.alert('Oops', error.message)
            console.log('Error confirming sign-up:', error);
        }
        setLoading(false);
    };

    // Function to resend code
    const handleResendCode = async ({ username }) => {
        if(loadingCode){
            return;
        }

        setLoadingCode(true);
        try{
            const {
                destination,
                deliveryMedium,
                attributeName
            } = await resendSignUpCode({ username });
            Alert.alert('Success', 'Code was resent to your email')
        }catch(e){
            Alert.alert('Oops', e.message)
        }
        setLoadingCode(false);
    };

  return (
    <View style={styles.container}>

        {/* Header */}
        <View style={styles.titleCon}>
            <Text style={styles.title}>
                Confirm Your Email
            </Text>
        </View>

        {/* Input */}
        <View style={styles.inputSection}>
        <Text style={styles.inputSub}>Enter Code</Text>
        <Controller
            name='confirmationCode'
            control={control}
            defaultValue=''
            rules={{
                required:'Confirmation Code is required',
            }}
            render={({field: {value, onChange, onBlur}})=>(
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder='Enter your code sent to your email'
                />
            )}
        />
        {errors.confirmationCode && <Text style={styles.errorText}>{errors.confirmationCode.message}</Text>}
        </View>

        <TouchableOpacity 
            style={styles.btnCon}
            onPress={handleSubmit(onSubmit)}
        >
            <Text style={styles.btnTxt}>{loading ? 'Confirming' : 'Confirm'}</Text>
        </TouchableOpacity>

        {/* Secondary button */}
        <View style={styles.secBtnSection}>
            {/* Resend Code */}
            <TouchableOpacity style={styles.secBtnCon} onPress={()=>handleResendCode({username})}>
                <Text style={styles.secBtnTxt}>{loadingCode ? 'Resending' : 'Resend code'}</Text>
            </TouchableOpacity>

            {/* Back to Sign In page */}
            <TouchableOpacity style={styles.secBtnCon} onPress={()=>router.push('/login')}>
                <Text style={styles.secBtnTxt}>Back to Sign In</Text>
            </TouchableOpacity>
        </View>
    </View>
  )
}

export default ConfirmEmailCom;