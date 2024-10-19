import { View, Text } from 'react-native'
import React, {useState, useContext, createContext} from 'react'

const LocationContext = createContext({})

const LocationProvider = ({children}) => {

    const [originPlace, setOriginPlace] = useState(null);
    const [originPlaceLat, setOriginPlaceLat] = useState(null);
    const [originPlaceLng, setOriginPlaceLng] = useState(null);
    const [destinationPlace, setDestinationPlace]= useState(null)
    const [destinationPlaceLat, setDestinationPlaceLat]= useState(null)
    const [destinationPlaceLng, setDestinationPlaceLng]= useState(null)
    const [lastDestination, setLastDestination] = useState(null);

  return (
    <LocationContext.Provider value={{originPlace, destinationPlace, setOriginPlace, originPlaceLat, setOriginPlaceLat, originPlaceLng, setOriginPlaceLng, setDestinationPlace, destinationPlaceLat, setDestinationPlaceLat, destinationPlaceLng, setDestinationPlaceLng, lastDestination, setLastDestination,}}>
        {children}
    </LocationContext.Provider>
  )
}

export default LocationProvider

export const useLocationContext = () => useContext(LocationContext)