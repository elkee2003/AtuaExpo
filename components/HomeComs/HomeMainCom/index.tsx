import { View, Text,  } from 'react-native'
import React, {useRef, useMemo} from 'react'
import HomeMap from '../HomeMap'
import HomeSearch from '../HomeSearch';
import BottomSheet, { BottomSheetScrollView,} from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import styles from './styles'

const HomeComponent = () => {
    const bottomSheetRef = useRef(null)
    const snapPoints = useMemo(()=>['25%', '37%'], [])
  return (
    <GestureHandlerRootView style={styles.container}>

        {/* Map */}
        <HomeMap/>

        {/* BottomSheet */}
        <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        topInset={1}
        >
            <BottomSheetScrollView>
                <HomeSearch/>
            </BottomSheetScrollView>
        </BottomSheet>
    </GestureHandlerRootView>
  )
}

export default HomeComponent