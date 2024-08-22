import { View, Text } from 'react-native'
import React, {useState, useContext, createContext} from 'react'

const LocationContext = createContext({})

const LocationProvider = ({children}) => {

    const [originPlace, setOriginPlace] = useState(null);
    const [destinationPlace, setDestinationPlace]= useState(null)

  return (
    <LocationContext.Provider value={{originPlace, destinationPlace, setOriginPlace, setDestinationPlace}}>
        {children}
    </LocationContext.Provider>
  )
}

export default LocationProvider

export const useLocationContext = () => useContext(LocationContext)