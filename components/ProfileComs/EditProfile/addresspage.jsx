import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import React, {useState, useRef} from 'react'
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { GOOGLE_API_KEY } from '@/keys';
import { useProfileContext } from '../../../providers/ProfileProvider';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Ionicons } from '@expo/vector-icons';
import styles from './styles'
import { router } from 'expo-router'

const AddressPage = () => {

    const [isFocused, setIsFocused] = useState(false);

    const autocompleteRef = useRef(null)

    const {exactAddress, setExactAddress, address, setAddress, setLat, setLng, errorMessage, onValidateAddressInput,} = useProfileContext()

    // function to handle focus
    const handleFocusChange = (focused) => {
        setIsFocused(focused);
    };

    // Start Of GooglePlacesAutoComplete function
    const handlePlaceSelect = (data, details = null) => {
        // Extract the address from the selected place
        const selectedAddress = data?.description || details?.formatted_address;

        const selectedAddylat = JSON.stringify(details?.geometry?.location.lat) 

        const selectedAddylng = JSON.stringify(details?.geometry?.location.lng) 

        console.log(selectedAddylng, selectedAddylat)

        // Update the address state
        setAddress(selectedAddress);
        setLat(selectedAddylat)
        setLng(selectedAddylng)

    };

    // function to clear autocompleter
    const handleClearAddress = () => {
        autocompleteRef.current?.clear(); // Clear the autocomplete input
        setAddress(null);
    };

    const handleNxtPage = () => {
        if (onValidateAddressInput()) {
            router.push('/profile/reviewprofile'); // Navigate to the profile screen upon successful validation
        }
    };

  return (
    <View style={styles.container}>
        <Text style={styles.title}>Address</Text>
        <TextInput 
            value={exactAddress}
            onChangeText={setExactAddress}
            placeholder='Input Exact Address'
            style={styles.input}
        />

        {/* Googleplaces autocomplete */}
        <View style={isFocused ? styles.gContainerFocused : styles.gContainer}>
            <GooglePlacesAutocomplete
            fetchDetails
            ref={autocompleteRef}
            placeholder='Select Address From Here'
            onPress={handlePlaceSelect}
            textInputProps={{
            onFocus:() => handleFocusChange(true),
            onBlur:() => handleFocusChange(false),
            
            }} 
            styles={{
            textInput:styles.gTextInput,
            textInputContainer:styles.gTextInputContainer,
            listView:styles.glistView,
            poweredContainer:styles.gPoweredContainer
            }}
            query={{
            key: GOOGLE_API_KEY,
            language: 'en',
            components: 'country:ng',
            }}
            />
            <TouchableOpacity onPress={handleClearAddress} style={styles.clearIconContainer}>
                <Ionicons name='close-circle' style={styles.clearIcon}/>
            </TouchableOpacity>
        </View>
        {/* Error Message */}
        <Text style={styles.error}>{errorMessage}</Text>

        {/* Btn Next */}
        <TouchableOpacity onPress={handleNxtPage} style={styles.addressNxtBtn}>
            <MaterialIcons name="navigate-next" style={styles.addressNxtBtnIcon} />
        </TouchableOpacity>
    </View>
  )
}

export default AddressPage;