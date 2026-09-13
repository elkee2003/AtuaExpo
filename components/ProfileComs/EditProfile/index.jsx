import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { signOut } from "aws-amplify/auth";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ============================================================
// SAFE AREA
// ============================================================
// Use SafeAreaView from react-native-safe-area-context instead
// of the deprecated/native React Native SafeAreaView.
// ============================================================

import { SafeAreaView } from "react-native-safe-area-context";

import { useProfileContext } from "../../../providers/ProfileProvider";
import styles from "./styles";

const EditProfile = ({ onRefresh, refreshing }) => {
  // ============================================================
  // PROFILE CONTEXT
  // ============================================================

  const {
    firstName,
    setFirstName,
    lastName,
    setLastName,
    profilePic,
    setProfilePic,
    phoneNumber,
    setPhoneNumber,
    errorMessage,
    onValidateInput,
  } = useProfileContext();

  // ============================================================
  // PROFILE IMAGE OPTIONS
  // ============================================================

  const showProfileImageOptions = () => {
    Alert.alert(
      "Profile Photo",
      "Choose how you want to update your profile photo.",
      [
        // --------------------------------------------------------
        // Take photo
        // --------------------------------------------------------
        {
          text: "Take Photo",
          onPress: openProfileCamera,
        },

        // --------------------------------------------------------
        // Choose from gallery
        // --------------------------------------------------------
        {
          text: "Choose from Gallery",
          onPress: pickProfileImage,
        },

        // --------------------------------------------------------
        // Remove photo
        // Only show this option when a photo exists.
        // --------------------------------------------------------
        ...(profilePic
          ? [
              {
                text: "Remove Photo",
                style: "destructive",
                onPress: () => setProfilePic(null),
              },
            ]
          : []),

        // --------------------------------------------------------
        // Cancel
        // --------------------------------------------------------
        {
          text: "Cancel",
          style: "cancel",
        },
      ],
      {
        cancelable: true,
      },
    );
  };

  // ============================================================
  // OPEN CAMERA
  // ============================================================

  const openProfileCamera = async () => {
    try {
      // ----------------------------------------------------------
      // Request camera permission.
      // ----------------------------------------------------------

      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Camera Permission",
          "Camera access is required to take a profile photo.",
        );

        return;
      }

      // ----------------------------------------------------------
      // Open camera.
      // ----------------------------------------------------------

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      // ----------------------------------------------------------
      // Save selected image URI.
      // ----------------------------------------------------------

      if (!result.canceled && result.assets?.[0]?.uri) {
        setProfilePic(result.assets[0].uri);
      }
    } catch (error) {
      console.log("Profile camera error:", error);

      Alert.alert(
        "Camera Error",
        "We couldn't open the camera. Please try again.",
      );
    }
  };

  // ============================================================
  // PICK PROFILE IMAGE
  // ============================================================

  const pickProfileImage = async () => {
    try {
      // ----------------------------------------------------------
      // Open device gallery.
      // ----------------------------------------------------------

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        mediaTypes: ["images"],
      });

      // ----------------------------------------------------------
      // Save selected image URI.
      // ----------------------------------------------------------

      if (!result.canceled && result.assets?.[0]?.uri) {
        setProfilePic(result.assets[0].uri);
      }
    } catch (error) {
      console.log("Profile image picker error:", error);

      Alert.alert(
        "Gallery Error",
        "We couldn't open your gallery. Please try again.",
      );
    }
  };

  // ============================================================
  // NAVIGATION
  // ============================================================

  const goToAddressPage = () => {
    // ----------------------------------------------------------
    // Validate profile information before continuing.
    // ----------------------------------------------------------

    if (onValidateInput()) {
      router.push("/profile/address");
    }
  };

  // ============================================================
  // SIGN OUT
  // ============================================================

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.log("Error signing out:", error);
    }
  };

  // ============================================================
  // SIGN OUT CONFIRMATION
  // ============================================================

  const onSignout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of your account.",
      [
        // --------------------------------------------------------
        // Cancel
        // --------------------------------------------------------
        {
          text: "Cancel",
          style: "cancel",
        },

        // --------------------------------------------------------
        // Confirm sign out
        // --------------------------------------------------------
        {
          text: "Sign Out",
          style: "destructive",
          onPress: handleSignOut,
        },
      ],
      {
        cancelable: true,
      },
    );
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
      >
        <View style={styles.container}>
          {/* ====================================================
              HEADER
          ==================================================== */}

          <View style={styles.header}>
            {/* Back button */}
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerIconButton}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={21} style={styles.headerIcon} />
            </TouchableOpacity>

            {/* Header title */}
            <View style={styles.headerCenter}>
              <Text style={styles.title}>Edit Profile</Text>

              <Text style={styles.headerSubtitle}>
                Keep your information up to date
              </Text>
            </View>

            {/* Sign out */}
            <TouchableOpacity
              onPress={onSignout}
              style={styles.signoutButton}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Ionicons
                name="log-out-outline"
                size={18}
                style={styles.signoutIcon}
              />
            </TouchableOpacity>
          </View>

          {/* ====================================================
              CONTENT
          ==================================================== */}

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {/* ==================================================
                PROFILE PHOTO
            ================================================== */}

            <View style={styles.photoSection}>
              <TouchableOpacity
                style={styles.profilePicContainer}
                onPress={showProfileImageOptions}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
              >
                {/* ------------------------------------------------
                    Existing profile photo
                ------------------------------------------------ */}

                {profilePic ? (
                  <Image
                    source={{
                      uri: profilePic,
                    }}
                    style={styles.img}
                  />
                ) : (
                  /* ------------------------------------------------
                     Empty profile photo state
                  ------------------------------------------------ */
                  <View style={styles.placeholderContainer}>
                    <View style={styles.placeholderIconCircle}>
                      <Ionicons
                        name="person-outline"
                        size={42}
                        style={styles.placeholderIcon}
                      />
                    </View>

                    <Text style={styles.addPhotoText}>Add photo</Text>
                  </View>
                )}

                {/* ------------------------------------------------
                    Camera badge
                ------------------------------------------------ */}

                <View style={styles.cameraIconContainer}>
                  <Ionicons name="camera" size={18} style={styles.cameraIcon} />
                </View>
              </TouchableOpacity>

              <Text style={styles.photoTitle}>Profile photo</Text>

              <Text style={styles.photoHint}>
                Use a clear photo of yourself
              </Text>
            </View>

            {/* ==================================================
                PERSONAL INFORMATION
            ================================================== */}

            <View style={styles.section}>
              {/* Section header */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <Ionicons
                    name="person-outline"
                    size={17}
                    style={styles.sectionIconGlyph}
                  />
                </View>

                <View>
                  <Text style={styles.sectionTitle}>Personal information</Text>

                  <Text style={styles.sectionSubtitle}>
                    Tell us a little about you
                  </Text>
                </View>
              </View>

              {/* =================================================
                  FIRST NAME / COMPANY NAME
              ================================================= */}

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>First name / Company name</Text>

                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="person-outline"
                    size={19}
                    style={styles.inputIcon}
                  />

                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Enter your first or company name"
                    placeholderTextColor="#8B93A1"
                    style={styles.input}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="next"
                    selectionColor="#07A830"
                  />
                </View>
              </View>

              {/* =================================================
                  LAST NAME
              ================================================= */}

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Last name</Text>

                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="person-outline"
                    size={19}
                    style={styles.inputIcon}
                  />

                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Enter your last name"
                    placeholderTextColor="#8B93A1"
                    style={styles.input}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="next"
                    selectionColor="#07A830"
                  />
                </View>
              </View>

              {/* =================================================
                  PHONE NUMBER
              ================================================= */}

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Phone number</Text>

                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="call-outline"
                    size={19}
                    style={styles.inputIcon}
                  />

                  <TextInput
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="Enter your phone number"
                    placeholderTextColor="#8B93A1"
                    style={styles.input}
                    keyboardType="phone-pad"
                    autoCorrect={false}
                    returnKeyType="done"
                    selectionColor="#07A830"
                  />
                </View>
              </View>
            </View>

            {/* ==================================================
                ERROR MESSAGE
            ================================================== */}

            {!!errorMessage && (
              <View style={styles.errorContainer}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  style={styles.errorIcon}
                />

                <Text style={styles.error}>{errorMessage}</Text>
              </View>
            )}

            {/* ==================================================
                BOTTOM BREATHING ROOM
            ================================================== */}

            <View style={styles.bottomSpacer} />
          </ScrollView>

          {/* ====================================================
              NEXT BUTTON
          ==================================================== */}

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={goToAddressPage}
              style={styles.nextButton}
              activeOpacity={0.86}
              accessibilityRole="button"
              accessibilityLabel="Continue to address"
            >
              <View style={styles.nextButtonTextContainer}>
                <Text style={styles.nextButtonLabel}>Continue</Text>

                <Text style={styles.nextButtonSubLabel}>Address details</Text>
              </View>

              <View style={styles.nextButtonIconContainer}>
                <MaterialIcons
                  name="arrow-forward"
                  size={23}
                  style={styles.nextButtonIcon}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default EditProfile;
