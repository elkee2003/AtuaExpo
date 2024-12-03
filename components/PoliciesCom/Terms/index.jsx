import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import React from 'react';
import * as Clipboard from 'expo-clipboard';
import styles from './styles';
import Feather from '@expo/vector-icons/Feather';

const TermAndConditions = () => {
  return (
    <ScrollView 
        style={styles.container}
        showsVerticalScrollIndicator={false}
    >
      <Text style={styles.header}>Terms and Conditions</Text>
        <Text style={styles.subHeader}>1. Introduction</Text>
        <Text style={styles.txt}>
            Welcome to Atua. By accessing or using our services, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, you may not use our services.
        </Text>

        <Text style={styles.subHeader}>2. Nature of the Platform</Text>
        <Text style={styles.txt}>
            Atua provides a platform to connect couriers ("Couriers") with individuals or businesses ("Senders") who wish to send packages. Atua acts solely as a facilitator and is not a party to any agreements or contracts formed between Senders and Couriers.
        </Text>

        <Text style={styles.subHeader}>3. Registration and Account</Text>
        <Text style={styles.txt}>
          <Text style={styles.pointer}>• Eligibility: </Text>	You must be at least 18 years old to use the Platform.
        </Text>
        <Text style={styles.txt}>
          <Text style={styles.pointer}>• Account Information: </Text> You agree to provide accurate and complete information when using our services.
          
        </Text>
        <Text style={styles.txt}>
          <Text style={styles.pointer}>• 	Responsibility: </Text>	Users are responsible for maintaining the confidentiality of their account credentials and for all activities under their account.
        </Text>
        
        <Text style={styles.subHeader}>4. User Obligations</Text>

        <Text style={styles.txtSubBold}>
            For Senders:
        </Text>
        <Text style={styles.txt}>
            <Text style={styles.pointer}>• </Text> Ensure the package complies with all applicable laws and regulations.
        </Text>

        <Text style={styles.txt}>
            <Text style={styles.pointer}>• </Text> Provide accurate details of the package, and content.
        </Text>

        <Text style={styles.txt}>
            <Text style={styles.pointer}>• </Text> Ensure timely availability of the package for pickup by the Courier.
        </Text>

        <Text style={styles.txtSubBold}>
            For Couriers:
        </Text>
        <Text style={styles.txt}>
            <Text style={styles.pointer}>• </Text> Comply with all applicable laws and regulations while delivering packages.
        </Text>

        <Text style={styles.txt}>
            <Text style={styles.pointer}>• </Text> Ensure timely and safe delivery of the package.
        </Text>

        <Text style={styles.txt}>
            <Text style={styles.pointer}>• </Text> Maintain professional conduct while interacting with Senders.
        </Text>

        <Text style={styles.subHeader}>5. Prohibited Items</Text>

        <Text style={styles.txt}>
            Senders are prohibited from shipping/sending:
        </Text>

        <Text style={styles.txt}>
            <Text style={styles.pointer}>• </Text> Illegal substances or items.
        </Text>

        <Text style={styles.txt}>
            <Text style={styles.pointer}>• </Text> Hazardous materials.
        </Text>

        <Text style={styles.txt}>
            <Text style={styles.pointer}>• </Text> Items prohibited by local or international laws.
        </Text>

        <Text style={styles.txt}>
            <Text style={styles.pointer}>• </Text> Perishable goods (unless explicitly agreed upon).
        </Text>

        <Text style={styles.subHeader}>6. Fees and Payments</Text>
        <Text style={styles.txt}>
          <Text style={styles.pointer}>• 	For Senders: </Text>	Fees for courier services are displayed at the time of booking and must be paid through the Platform.
        </Text>

        <Text style={styles.txt}>
          <Text style={styles.pointer}>• 	For Couriers: </Text>	Payment for services rendered will be processed through the Platform, subject to applicable transaction fees.
        </Text>

        <Text style={styles.subHeader}>7. Liability</Text>

        <Text style={styles.txt}>
            Atua is not responsible for:
        </Text>

        <Text style={styles.txt}>
            <Text style={styles.pointer}>• </Text> Damages, loss, or theft of packages
        </Text>

        <Text style={styles.txt}>
            <Text style={styles.pointer}>• </Text> Delays in delivery.
        </Text>

        <Text style={styles.txt}>
            <Text style={styles.pointer}>• </Text> Any disputes between Senders and Couriers.
        </Text>

        <Text style={styles.subHeader}>8. Termination</Text>

        <Text style={styles.txt}>
            Atua reserves the right to suspend or terminate a User's account if they violate these Terms or engage in unlawful activities.
        </Text>

        <Text style={styles.subHeader}>9. Modifications of Terms</Text>

        <Text style={styles.txt}>
            Atua reserves the right to modify these Terms at any time. Users will be notified of significant changes, and continued use of the Platform constitutes acceptance of the updated Terms.
        </Text>

        <Text style={styles.subHeader}>10. Governing Law</Text>

        <Text style={styles.txt}>
            These Terms are governed by the laws of the Federal Republic of Nigeria. Any disputes arising from or related to these Terms or the use of the platform shall be resolved exclusively in the courts of Nigeria.
        </Text>
        

        
        <Text style={styles.subHeader}>11. Contact Us</Text>
      <Text style={styles.txt}>
        If you have questions regarding these Terms, please contact us at:
      </Text>

      {/* Email Support */}
      <TouchableOpacity
          style={styles.supportConEmail}
          onPress={() => {
            Clipboard.setStringAsync('support@atuainc.com');
            alert('Email address copied to clipboard!');
          }}
      >
        <Feather style={styles.emailIcon} name="mail" />
        <Text style={styles.supportEmail}>
          support@atuainc.com
        </Text>
      </TouchableOpacity>

      {/* Phone Support */}
      <TouchableOpacity
        style={styles.supportConPhone}
        onPress={() => {
          Clipboard.setStringAsync('+234 704 296 1902');
          alert('Phone Number copied to clipboard!');
        }}
      >
        <Feather name="phone" style={styles.phoneIcon} />
        <Text style={styles.supportPhone}>
          +234 704 296 1902
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

export default TermAndConditions;