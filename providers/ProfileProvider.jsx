import { View, Text } from 'react-native'
import React, {useState, useContext, useEffect, createContext} from 'react'
import { useAuthContext } from './AuthProvider';

const ProfileContext = createContext({})

const ProfileProvider = ({children}) => {

    const {dbUser} = useAuthContext()

    const [profilePic, setProfilePic] = useState(null)
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [exactAddress, setExactAddress] = useState("")
    const [address, setAddress] = useState(" ")
    const [lat, setLat] = useState('0')
    const [lng, setLng] = useState('0')
    const [phoneNumber, setPhoneNumber]= useState("")
    const [errorMessage, setErrorMessage] = useState('')

    const validateInput = () =>{
        setErrorMessage('')

        if(!firstName){
          setErrorMessage('First Name is Required')
          return false;
        }
        if(phoneNumber.length < 10){
          setErrorMessage('Kindly fill in Phone Number')
          return false;
        }
        return true;
    }

    const onValidateInput = () =>{
        if(validateInput()){
          return true;
        }else {
          return false;
        }
    }

    // Address Input Validation
    const validateAddressInput = () =>{
      setErrorMessage('')

      if(!exactAddress){
        setErrorMessage('Exact Address is required')
        return false;
      }
      if(!address){
        setErrorMessage('Address is required')
        return false;
      }

      return true;
    }

    const onValidateAddressInput = () =>{
      if(validateAddressInput()){
        return true;
      }else {
        return false;
      }
    }

    useEffect(() => {
        if (dbUser) {
            setProfilePic(dbUser?.profilePic);
            setFirstName(dbUser.firstName || "");
            setLastName(dbUser.lastName || "");
            setExactAddress(dbUser.exactAddress || "");
            setAddress(dbUser.address || "");
            setPhoneNumber(dbUser.phoneNumber || "");
            setLat(dbUser.lat.toString() || "0");
            setLng(dbUser.lng.toString() || "0");
        }
    }, [dbUser]); // This effect runs whenever dbUser changes

  return (
    <ProfileContext.Provider value={{firstName,setFirstName, lastName, setLastName, exactAddress, setExactAddress, address, setAddress, lat, setLat, lng, setLng, phoneNumber, setPhoneNumber, errorMessage, setErrorMessage, profilePic, setProfilePic, onValidateInput, onValidateAddressInput}}>
        {children}
    </ProfileContext.Provider>
  )
}

export default ProfileProvider

export const useProfileContext = () => useContext(ProfileContext)