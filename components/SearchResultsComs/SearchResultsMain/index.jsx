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

    // Surcharges
    const [isPeakHour, setIsPeakHour] = useState(false);
    const [isWeekend, setIsWeekend] = useState(false);
    const [isHighTrafficArea, setIsHighTrafficArea] = useState(false);
    const [isNightTime, setIsNightTime] = useState(false);
    const [isHeavyItem, setIsHeavyItem] = useState(false);
    const [isFragileItem, setIsFragileItem] = useState(false);
    // const [isLongDistance, setIsLongDistance] = useState(false);
    // const [isRushDelivery, setIsRushDelivery] = useState(false);
    const [isHoliday, setIsHoliday] = useState(false);


  return (
    <GestureHandlerRootView style={styles.container}>

        {/* Map */}
        <ResultMap
        setTotalMins={setTotalMins}
        setTotalKm={setTotalKm}
        setIsPeakHour={setIsPeakHour}
        setIsWeekend={setIsWeekend}
        setIsHighTrafficArea={setIsHighTrafficArea}
        // setIsLongDistance={setIsLongDistance}
        // setIsRushDelivery={setIsRushDelivery}
        setIsNightTime={setIsNightTime}
        setIsHoliday={setIsHoliday}
        setIsHeavyItem={setIsHeavyItem}
        setIsFragileItem={setIsFragileItem}
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
                isPeakHour={isPeakHour}
                isWeekend={isWeekend}
                isHighTrafficArea={isHighTrafficArea}
                // isLongDistance={isLongDistance}
                // isRushDelivery={isRushDelivery}
                isNightTime={isNightTime}
                isHoliday={isHoliday}
                isHeavyItem={isHeavyItem}
                isFragileItem={isFragileItem}
                />
            </BottomSheetScrollView>
        </BottomSheet>
    </GestureHandlerRootView>
  )
}

export default SearchResultComponent