import { View, Text, Pressable   } from 'react-native'
import React, {useRef, useMemo, useState} from 'react'
import ResultMap from '../ResultMap'
import AtuaTypes from '../AtuaTypes';
import BottomSheet, { BottomSheetScrollView,} from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Ionicons from '@expo/vector-icons/Ionicons';
import styles from './styles'
import { router } from 'expo-router';

const SearchResultComponent = () => {
    const bottomSheetRef = useRef(null)
    const snapPoints = useMemo(()=>['30%', '55%', ], [])

    const [selectedType, setSelectedType]= useState(null)
    const [calculatedPrice, setCalculatedPrice]= useState(null)
    const [totalMins, setTotalMins]=useState(0);
    const [totalKm, setTotalKm]=useState(0);


  return (
    <GestureHandlerRootView style={styles.container}>

        {/* Map */}
        <ResultMap
        totalMins={totalMins}
        setTotalMins={setTotalMins}
        totalKm={totalKm}
        setTotalKm={setTotalKm}
        />

        <Pressable onPress={()=>router.back()} style={styles.bckBtn}>
          <Ionicons name="arrow-back" style={styles.bckBtnIcon} />
        </Pressable>

        {/* BottomSheet */}
        <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        topInset={1}
        >
            <BottomSheetScrollView>
                <AtuaTypes
                selectedType={selectedType}
                setSelectedType={setSelectedType}
                calculatedPrice={calculatedPrice}
                setCalculatedPrice={setCalculatedPrice}
                totalMins={totalMins}
                totalKm={totalKm}
                />
            </BottomSheetScrollView>
        </BottomSheet>
    </GestureHandlerRootView>
  )
}

export default SearchResultComponent