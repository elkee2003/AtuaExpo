import { View, Text } from 'react-native'
import React, {useState, useContext, createContext} from 'react'

const LocationContext = createContext({})

const LocationProvider = ({children}) => {

    const [originPlace, setOriginPlace] = useState(null);
    const [destinationPlace, setDestinationPlace]= useState(null)
    const [lastDestination, setLastDestination] = useState(null);

  return (
    <LocationContext.Provider value={{originPlace, destinationPlace, setOriginPlace, setDestinationPlace, lastDestination, setLastDestination,}}>
        {children}
    </LocationContext.Provider>
  )
}

export default LocationProvider

export const useLocationContext = () => useContext(LocationContext)