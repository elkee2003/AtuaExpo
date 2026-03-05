import React, { createContext, useContext, useState } from "react";

const LocationContext = createContext({});

const LocationProvider = ({ children }) => {
  const [originAddress, setOriginAddress] = useState(null);
  const [originLat, setOriginLat] = useState(null);
  const [originLng, setOriginLng] = useState(null);
  const [destinationAddress, setDestinationAddress] = useState(null);
  const [destinationLat, setDestinationLat] = useState(null);
  const [destinationLng, setDestinationLng] = useState(null);
  const [lastDestination, setLastDestination] = useState(null);
  const [originState, setOriginState] = useState(null);
  const [destinationState, setDestinationState] = useState(null);
  const [totalMins, setTotalMins] = useState(0);
  const [totalKm, setTotalKm] = useState(0);
  const [isInterState, setIsInterState] = useState(false);
  const [tripType, setTripType] = useState("");

  const resetAllLocationFields = () => {
    setOriginAddress(null);
    setOriginLat(null);
    setOriginLng(null);

    setDestinationAddress(null);
    setDestinationLat(null);
    setDestinationLng(null);

    setOriginState(null);
    setDestinationState(null);

    setTotalMins(0);
    setTotalKm(0);

    setIsInterState(false);
    setTripType("");
  };

  const resetDestinationOnly = () => {
    setDestinationAddress(null);
    setDestinationLat(null);
    setDestinationLng(null);
    setDestinationState(null);
  };

  const resetOriginOnly = () => {
    setOriginAddress(null);
    setOriginLat(null);
    setOriginLng(null);
    setOriginState(null);
  };

  return (
    <LocationContext.Provider
      value={{
        originAddress,
        destinationAddress,
        setOriginAddress,
        originLat,
        setOriginLat,
        originLng,
        setOriginLng,
        setDestinationAddress,
        destinationLat,
        setDestinationLat,
        destinationLng,
        setDestinationLng,
        lastDestination,
        setLastDestination,
        originState,
        setOriginState,
        destinationState,
        setDestinationState,
        totalMins,
        setTotalMins,
        totalKm,
        setTotalKm,
        isInterState,
        setIsInterState,
        tripType,
        setTripType,
        resetAllLocationFields,
        resetDestinationOnly,
        resetOriginOnly,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export default LocationProvider;

export const useLocationContext = () => useContext(LocationContext);
