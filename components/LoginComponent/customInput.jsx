import { View, Text, TextInput,  TouchableOpacity } from 'react-native'
import React, {useState} from 'react'
import styles from './styles'
import { Ionicons } from '@expo/vector-icons'; 
import { Controller } from 'react-hook-form';
import { router } from 'expo-router'

const CustomInput = ({control, name, rules ={}, placeholder, inputSub, secureTextEntry, isPasswordVisible, setIsPasswordVisible}) => {

  return (
    <View >

        {/* Inputs */}
        <View style={styles.inputSection}>
            <Text style={styles.inputSub}>
                {inputSub}
            </Text>
            <Controller
                name={name}
                control={control}
                defaultValue=''
                rules={rules}
                render={({field:{value, onChange, onBlur}, fieldState:{error}})=>(
                    <>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={[styles.input, error && styles.errorBorder]}
                                value={value}
                                onChangeText={onChange}
                                onBlur={onBlur}
                                placeholder={placeholder}
                                autoCapitalize='none'
                                secureTextEntry={secureTextEntry}
                            />
                            {/* Eye Icon for password visibility toggle */}
                            {inputSub === 'Password' && (
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
                            )}
                        </View>
                        {error && <Text style={styles.errorText}>{error.message}</Text>}
                    </>
                )}
            />
            
            {/* <Text style={styles.inputSub}>{inputSub}</Text>
            <TextInput
                style={styles.input}
                value={password}
                onChangeText={value}
                secureTextEntry
                placeholder={placeholder}
            /> */}
        </View>
    </View>
  )
}

export default CustomInput;