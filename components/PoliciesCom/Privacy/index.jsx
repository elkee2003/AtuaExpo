import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import React from 'react';
import * as Clipboard from 'expo-clipboard';
import styles from './styles';
import Fontisto from '@expo/vector-icons/Fontisto';
import Feather from '@expo/vector-icons/Feather';


const PrivacyPolicy = () => {
  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.container}>
      <Text style={styles.header}>Privacy Policy</Text>

      <Text style={styles.subHeader}>1. Introduction</Text>
      <Text style={styles.txt}>
        Atua values your privacy. This Privacy Policy explains how we collect, use, and share your information when you use our services.
      </Text>
      
      <Text style={styles.subHeader}>
        2. Information We Collect
      </Text>
      <Text style={styles.txt}>
        From Senders and Couriers:
      </Text>
      <Text style={styles.txt}>
        <Text style={styles.pointer}>• 	Personal Information: </Text>	Name, email address, phone number, and payment details.
      </Text>
      <Text style={styles.txt}>
        <Text style={styles.pointer}>• 	Location Information:</Text>	GPS data to facilitate package delivery.
      </Text>

      <Text style={styles.txt}>
        <Text style={styles.pointer}>• 	Usage Information: </Text> Information about how you use the Platform.
      </Text>

      <Text style={styles.subHeader}>
        3. How We Use Your Information
      </Text>

      <Text style={styles.txt}>
        <Text style={styles.pointer}>• </Text> To facilitate connections between Senders and Couriers.
      </Text>
      <Text style={styles.txt}>
        <Text style={styles.pointer}>• </Text>	To process payments and payouts.
      </Text>

      <Text style={styles.txt}>
        <Text style={styles.pointer}>• </Text> To improve and personalize the Platform.
      </Text>

      <Text style={styles.txt}>
        <Text style={styles.pointer}>• </Text> To communicate with Users regarding updates and support.
      </Text>

      <Text style={styles.subHeader}>
        4. Sharing of Information
      </Text>

      <Text style={styles.txt}>
        We may share your information:
      </Text>

      <Text style={styles.txt}>
        <Text style={styles.pointer}>• </Text> With Couriers or Senders to facilitate delivery.
      </Text>

      <Text style={styles.txt}>
        <Text style={styles.pointer}>• </Text>	With service providers to support Platform functionality.
      </Text>

      <Text style={styles.txt}>
        <Text style={styles.pointer}>• </Text> When required by law or to protect the rights of Atua.
      </Text>

      <Text style={styles.subHeader}>
        5. Data Security
      </Text>
      <Text style={styles.txt}>
        Atua employs reasonable measures to protect User data. However, no method of transmission over the internet is entirely secure, and we cannot guarantee absolute security.
      </Text>

      <Text style={styles.subHeader}>
        6. User Rights
      </Text>
      <Text style={styles.txt}>
        <Text style={styles.pointer}>• Access and Update: </Text> Users can access and update their information through their account.
      </Text>

      <Text style={styles.txt}>
        <Text style={styles.pointer}>• 	Deletion: </Text> Users can access and update their information through their account.
      </Text>

      <Text style={styles.subHeader}>
        7. Cookies
      </Text>
      <Text style={styles.txt}>
        The Platform uses cookies to enhance User experience and gather analytics. Users can manage cookie preferences through their browser settings.
      </Text>

      <Text style={styles.subHeader}>
        8. Third-Party Links
      </Text>
      <Text style={styles.txt}>
        Our website or app may contain links to third-party websites. We are not responsible for the privacy practices of these websites and recommend reviewing their privacy policies.
      </Text>

      <Text style={styles.subHeader}>
        9. Changes to Privacy Policy
      </Text>
      <Text style={styles.txt}>
        We may update this Privacy Policy from time to time. Significant changes will be communicated to Users, and continued use of the Platform constitutes acceptance of the updated policy.
      </Text>

      <Text style={styles.subHeader}>10. Contact Us</Text>
      <Text style={styles.txt}>
        If you have any questions about this Privacy Policy or your personal data, please contact us at:
      </Text>

      {/* Email Support */}
      <TouchableOpacity
          style={styles.supportConEmail}
          onPress={() => {
            Clipboard.setStringAsync('support@atuainc.com');
            alert('Email address copied to clipboard!');
          }}
      >
        <Fontisto style={styles.emailIcon} name="email" />
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

export default PrivacyPolicy;