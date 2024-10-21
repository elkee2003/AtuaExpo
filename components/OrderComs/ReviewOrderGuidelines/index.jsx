import { View, Text } from 'react-native'
import React from 'react'
import styles from './styles'


const ReviewOrderGuidelines = () => {

  return (
    <View style={styles.container}>

        {/*Main header  */}
        <View style={styles.policy}>
            <Text style={styles.mainHeader}>Review parcel guidelines</Text>

            {/* Header */}
            <Text style={styles.header}>To achieve a successful delivery, please confirm that your parcel is:</Text>
            <Text style={styles.policyTxt}>• ₦30,000 or less in value</Text>
            <Text style={styles.policyTxt}>• 
                Properly sealed and prepared for collection
            </Text>
        </View>

        <View style={styles.policy}>
            <Text style={styles.header}>Prohibited Items</Text>
            {/* <Text style={styles.policyTxt}>
                Alcohol, medication, drugs, firearms, and dangerous or illegal items are prohibited. Items sent via Atua must comply with all laws and regulations and with Atua policies. Any Violations may be reported to authorities and app access may be removed. Atua will cooperate with law enforcement on any illegal activity.
            </Text> */}
            <Text style={styles.policyTxt}>
                Prohibited items include  medication, firearms, alcohol, drugs, and any dangerous or illegal substances. All parcels sent via Atua must adhere to applicable laws, regulations, and Atua's policies. Any violations may be reported to authorities, which may also lead to the removal of app access. Atua will cooperate with law enforcement on any illegal activity.
            </Text>
        </View>
        <View>
            <Text style={styles.policyLastTxt}>
            Atua does not provide insurance for parcels. By tapping done, you acknowledge and accept this.
            </Text>
        </View>
    </View>
  )
}

export default ReviewOrderGuidelines