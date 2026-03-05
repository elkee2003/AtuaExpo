import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import {
  Image,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useProfileContext } from "../../../providers/ProfileProvider";
import styles from "./styles";

const ReviewUser = () => {
  const {
    firstName,
    lastName,
    profilePic,
    exactAddress,
    address,
    phoneNumber,
  } = useProfileContext();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* ================= HEADER ================= */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Profile Review</Text>

        <TouchableOpacity
          onPress={() => router.push("/profile/editprofile")}
          style={styles.iconButton}
        >
          <Ionicons name="create-outline" size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* ================= CONTENT ================= */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {/* PROFILE HERO */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            {profilePic ? (
              <Image source={{ uri: profilePic }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="#9CA3AF" />
              </View>
            )}
          </View>

          <Text style={styles.fullName}>
            {firstName} {lastName}
          </Text>

          <Text style={styles.subtitle}>Verified Account</Text>
        </View>

        {/* CONTACT SECTION */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

          <View style={styles.infoRow}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="phone" size={18} color="#111827" />
            </View>
            <View style={styles.textBlock}>
              <Text style={styles.label}>Phone Number</Text>
              <Text style={styles.value}>{phoneNumber}</Text>
            </View>
          </View>
        </View>

        {/* ADDRESS SECTION */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Address Details</Text>

          <View style={styles.infoBlock}>
            <Text style={styles.label}>Exact Address</Text>
            <Text style={styles.value}>{exactAddress}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoBlock}>
            <Text style={styles.label}>Selected Location</Text>
            <Text style={styles.value}>{address}</Text>
          </View>
        </View>
      </ScrollView>

      {/* ================= BOTTOM CTA ================= */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push("/profile")}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Confirm Profile</Text>
          <Ionicons name="checkmark-circle" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ReviewUser;
