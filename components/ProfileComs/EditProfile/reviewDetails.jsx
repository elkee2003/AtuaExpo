import Ionicons from "@expo/vector-icons/Ionicons";
import { DataStore } from "aws-amplify/datastore";
import { remove, uploadData } from "aws-amplify/storage";
import * as Crypto from "expo-crypto";
import * as ImageManipulator from "expo-image-manipulator";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthContext } from "../../../providers/AuthProvider";
import { useProfileContext } from "../../../providers/ProfileProvider";
import { User } from "../../../src/models";

import styles from "./styles";

const ReviewUserCom = () => {
  // ============================================================
  // PROFILE CONTEXT
  // ============================================================

  const {
    firstName,
    lastName,
    setProfilePic,
    profilePic,
    exactAddress,
    address,
    lat,
    lng,
    phoneNumber,
  } = useProfileContext();

  // ============================================================
  // AUTH CONTEXT
  // ============================================================

  const { dbUser, setDbUser, sub, userMail } = useAuthContext();

  // ============================================================
  // LOCAL STATE
  // ============================================================

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ============================================================
  // PROFILE IMAGE UPLOAD
  // ============================================================

  const uploadImage = async () => {
    try {
      /*
       * If this is an existing user, remove the previous
       * profile image before uploading the new one.
       */
      if (dbUser?.profilePic) {
        console.log("Deleting previous profile photo:", dbUser.profilePic);

        await remove({
          path: dbUser.profilePic,
        });
      }

      /*
       * If there is no profile image, simply return null.
       *
       * This allows the user to save their profile without
       * having a profile photo.
       */
      if (!profilePic) {
        return null;
      }

      // ----------------------------------------------------------
      // Resize and compress image before upload.
      // ----------------------------------------------------------

      const manipulatedImage = await ImageManipulator.manipulateAsync(
        profilePic,
        [
          {
            resize: {
              width: 800,
            },
          },
        ],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      // ----------------------------------------------------------
      // Convert processed image to Blob.
      // ----------------------------------------------------------

      const response = await fetch(manipulatedImage.uri);

      const blob = await response.blob();

      // ----------------------------------------------------------
      // Generate a unique S3 path.
      // ----------------------------------------------------------

      const fileKey = `public/profilePhoto/${sub}/${Crypto.randomUUID()}.jpg`;

      // ----------------------------------------------------------
      // Upload image to S3.
      // ----------------------------------------------------------

      const result = await uploadData({
        path: fileKey,
        data: blob,

        options: {
          contentType: "image/jpeg",

          onProgress: ({ transferredBytes, totalBytes }) => {
            if (totalBytes) {
              const progress = Math.round(
                (transferredBytes / totalBytes) * 100,
              );

              setUploadProgress(progress);

              console.log(`Profile upload progress: ${progress}%`);
            }
          },
        },
      }).result;

      return result.path;
    } catch (error) {
      console.log("Error uploading profile image:", error);

      throw error;
    }
  };

  // ============================================================
  // DELETE PROFILE IMAGE
  // ============================================================

  const deleteProfilePic = async () => {
    if (!dbUser?.profilePic) {
      return;
    }

    setUploading(true);

    try {
      const filePath = dbUser.profilePic;

      // ----------------------------------------------------------
      // Delete image from S3.
      // ----------------------------------------------------------

      await remove({
        path: filePath,
      });

      // ----------------------------------------------------------
      // Remove profile image reference from DataStore.
      // ----------------------------------------------------------

      const updatedUser = await DataStore.save(
        User.copyOf(dbUser, (updated) => {
          updated.profilePic = null;
        }),
      );

      // ----------------------------------------------------------
      // Update local auth state.
      // ----------------------------------------------------------

      setDbUser(updatedUser);

      setProfilePic(null);

      Alert.alert(
        "Profile Photo Removed",
        "Your profile photo has been removed successfully.",
      );
    } catch (error) {
      console.log("Error removing profile picture:", error);

      Alert.alert(
        "Unable to Remove Photo",
        "Something went wrong while removing your profile photo. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  // ============================================================
  // CONFIRM PROFILE PHOTO DELETE
  // ============================================================

  const confirmDeleteProfilePic = () => {
    Alert.alert(
      "Remove Profile Photo",
      "Are you sure you want to remove your profile photo?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: deleteProfilePic,
        },
      ],
      {
        cancelable: true,
      },
    );
  };

  // ============================================================
  // CREATE USER
  // ============================================================

  const createUser = async () => {
    if (uploading) {
      return false;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // ----------------------------------------------------------
      // First check if the user already exists.
      // ----------------------------------------------------------

      let existingUsers = await DataStore.query(User, (u) => u.sub.eq(sub));

      // ----------------------------------------------------------
      // Retry after restarting DataStore.
      //
      // This preserves your existing workaround for cases where
      // the local DataStore has not synchronized the user yet.
      // ----------------------------------------------------------

      if (existingUsers.length === 0) {
        console.log("No local user found — retrying DataStore sync...");

        await DataStore.clear();

        await DataStore.start();

        existingUsers = await DataStore.query(User, (u) => u.sub.eq(sub));
      }

      // ----------------------------------------------------------
      // Prevent duplicate user creation.
      // ----------------------------------------------------------

      if (existingUsers.length > 0) {
        console.log("User already exists — skipping creation.");

        setDbUser(existingUsers[0]);

        return true;
      }

      // ----------------------------------------------------------
      // Upload profile image.
      // ----------------------------------------------------------

      const uploadedImagePath = await uploadImage();

      // ----------------------------------------------------------
      // Create new user.
      // ----------------------------------------------------------

      const user = await DataStore.save(
        new User({
          profilePic: uploadedImagePath,

          firstName,
          lastName,

          email: userMail,

          exactAddress,
          address,

          phoneNumber,

          lat: lat !== null && lat !== undefined ? parseFloat(lat) : null,

          lng: lng !== null && lng !== undefined ? parseFloat(lng) : null,

          sub,
        }),
      );

      // ----------------------------------------------------------
      // Update local user state.
      // ----------------------------------------------------------

      setDbUser(user);

      return true;
    } catch (error) {
      console.log("Error creating user:", error);

      Alert.alert(
        "Unable to Save Profile",
        error?.message || "Something went wrong while creating your profile.",
      );

      return false;
    } finally {
      setUploading(false);
    }
  };

  // ============================================================
  // UPDATE USER
  // ============================================================

  const updateUser = async () => {
    if (uploading || !dbUser) {
      return false;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      /*
       * Upload the new image first.
       *
       * If the user has removed their image, uploadImage()
       * returns null.
       */
      const uploadedImagePath = await uploadImage();

      // ----------------------------------------------------------
      // Update existing user.
      // ----------------------------------------------------------

      const user = await DataStore.save(
        User.copyOf(dbUser, (updated) => {
          updated.firstName = firstName;

          updated.lastName = lastName;

          updated.email = userMail;

          updated.profilePic = uploadedImagePath;

          updated.exactAddress = exactAddress;

          updated.address = address;

          updated.phoneNumber = phoneNumber;

          updated.lat =
            lat !== null && lat !== undefined ? parseFloat(lat) : null;

          updated.lng =
            lng !== null && lng !== undefined ? parseFloat(lng) : null;
        }),
      );

      // ----------------------------------------------------------
      // Update local auth state.
      // ----------------------------------------------------------

      setDbUser(user);

      return true;
    } catch (error) {
      console.log("Error updating user:", error);

      Alert.alert(
        "Unable to Save Changes",
        error?.message || "Something went wrong while updating your profile.",
      );

      return false;
    } finally {
      setUploading(false);
    }
  };

  // ============================================================
  // SAVE PROFILE
  // ============================================================

  const handleSave = async () => {
    if (uploading) {
      return;
    }

    let success = false;

    // ----------------------------------------------------------
    // Existing user → update.
    // ----------------------------------------------------------

    if (dbUser) {
      success = await updateUser();
    }

    // ----------------------------------------------------------
    // New user → create.
    // ----------------------------------------------------------
    else {
      success = await createUser();
    }

    // ----------------------------------------------------------
    // Do not navigate if saving failed.
    // ----------------------------------------------------------

    if (!success) {
      return;
    }

    // ----------------------------------------------------------
    // Navigate to profile.
    // ----------------------------------------------------------

    router.replace("/profile");

    // ----------------------------------------------------------
    // Then continue to home.
    // ----------------------------------------------------------

    setTimeout(() => {
      router.replace("/home");
    }, 1000);
  };

  // ============================================================
  // PROFILE INFORMATION ROW
  // ============================================================

  const ProfileRow = ({ icon, label, value, last = false }) => {
    return (
      <View style={[styles.infoRow, last && styles.infoRowLast]}>
        {/* Icon */}
        <View style={styles.infoIconContainer}>
          <Ionicons name={icon} size={19} style={styles.infoIcon} />
        </View>

        {/* Information */}
        <View style={styles.infoContent}>
          <Text style={styles.infoLabel}>{label}</Text>

          <Text style={styles.infoValue} numberOfLines={4}>
            {value || "Not provided"}
          </Text>
        </View>

        {/* Confirmation */}
        <Ionicons name="checkmark-circle" size={18} style={styles.infoCheck} />
      </View>
    );
  };

  // ============================================================
  // SCREEN
  // ============================================================

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.container}>
        {/* ======================================================
            HEADER
        ====================================================== */}

        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerIconButton}
            disabled={uploading}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={21} style={styles.headerIcon} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.title}>Review Profile</Text>

            <Text style={styles.headerSubtitle}>Everything looks good?</Text>
          </View>

          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            <Text style={styles.stepNumber}>3</Text>

            <Text style={styles.stepTotal}>/ 3</Text>
          </View>
        </View>

        {/* ======================================================
            PROGRESS
        ====================================================== */}

        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={styles.progressFillComplete} />
          </View>

          <View style={styles.progressLabels}>
            <Text style={styles.progressText}>Profile</Text>

            <Text style={styles.progressText}>Address</Text>

            <Text style={styles.progressTextActive}>Review</Text>
          </View>
        </View>

        {/* ======================================================
            CONTENT
        ====================================================== */}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ====================================================
              COMPLETION CARD
          ==================================================== */}

          <View style={styles.completionCard}>
            <View style={styles.completionIconContainer}>
              <Ionicons
                name="checkmark"
                size={27}
                style={styles.completionIcon}
              />
            </View>

            <View style={styles.completionContent}>
              <Text style={styles.completionTitle}>Profile almost ready</Text>

              <Text style={styles.completionText}>
                Review your information below. You can save everything when
                you're happy with the details.
              </Text>
            </View>
          </View>

          {/* ====================================================
              PROFILE PHOTO
          ==================================================== */}

          <View style={styles.photoCard}>
            <View style={styles.photoCardHeader}>
              <View>
                <Text style={styles.photoCardTitle}>Profile photo</Text>

                <Text style={styles.photoCardSubtitle}>
                  Your profile picture
                </Text>
              </View>

              {profilePic && (
                <TouchableOpacity
                  onPress={confirmDeleteProfilePic}
                  disabled={uploading}
                  style={styles.removePhotoButton}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Remove profile photo"
                >
                  <Ionicons
                    name="trash-outline"
                    size={17}
                    style={styles.removePhotoIcon}
                  />

                  <Text style={styles.removePhotoText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.photoCardBody}>
              <View style={styles.reviewProfilePicContainer}>
                {profilePic ? (
                  <Image
                    source={{
                      uri: profilePic,
                    }}
                    style={styles.img}
                  />
                ) : (
                  <View style={styles.reviewPlaceholder}>
                    <View style={styles.reviewPlaceholderIcon}>
                      <Ionicons
                        name="person-outline"
                        size={38}
                        style={styles.reviewPlaceholderGlyph}
                      />
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.photoStatus}>
                <View
                  style={profilePic ? styles.statusDot : styles.statusDotMuted}
                />

                <Text
                  style={
                    profilePic
                      ? styles.photoStatusText
                      : styles.photoStatusTextMuted
                  }
                >
                  {profilePic ? "Photo added" : "No photo added"}
                </Text>
              </View>
            </View>
          </View>

          {/* ====================================================
              PERSONAL INFORMATION
          ==================================================== */}

          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons
                  name="person-outline"
                  size={18}
                  style={styles.cardHeaderIconGlyph}
                />
              </View>

              <View>
                <Text style={styles.cardTitle}>Personal information</Text>

                <Text style={styles.cardSubtitle}>
                  Your basic profile details
                </Text>
              </View>
            </View>

            <View style={styles.infoList}>
              <ProfileRow
                icon="person-outline"
                label="First name / Company"
                value={firstName}
              />

              <ProfileRow
                icon="person-outline"
                label="Last name"
                value={lastName}
              />

              <ProfileRow
                icon="call-outline"
                label="Phone number"
                value={phoneNumber}
                last
              />
            </View>
          </View>

          {/* ====================================================
              ADDRESS INFORMATION
          ==================================================== */}

          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  style={styles.cardHeaderIconGlyph}
                />
              </View>

              <View>
                <Text style={styles.cardTitle}>Location</Text>

                <Text style={styles.cardSubtitle}>
                  Your address and map location
                </Text>
              </View>
            </View>

            <View style={styles.infoList}>
              <ProfileRow
                icon="home-outline"
                label="Exact address"
                value={exactAddress}
              />

              <ProfileRow
                icon="map-outline"
                label="Selected location"
                value={address}
                last
              />
            </View>
          </View>

          {/* ====================================================
              LOCATION CONFIRMATION
          ==================================================== */}

          {address && (
            <View style={styles.locationConfirmation}>
              <View style={styles.locationConfirmationIcon}>
                <Ionicons
                  name="navigate-outline"
                  size={19}
                  style={styles.locationConfirmationGlyph}
                />
              </View>

              <View style={styles.locationConfirmationContent}>
                <Text style={styles.locationConfirmationTitle}>
                  Location confirmed
                </Text>

                <Text style={styles.locationConfirmationText}>
                  Your selected address and map coordinates will be saved with
                  your profile.
                </Text>
              </View>

              <Ionicons
                name="checkmark-circle"
                size={20}
                style={styles.locationConfirmationCheck}
              />
            </View>
          )}

          {/* ====================================================
              FINAL MESSAGE
          ==================================================== */}

          <View style={styles.finalMessage}>
            <Ionicons
              name="shield-checkmark-outline"
              size={19}
              style={styles.finalMessageIcon}
            />

            <Text style={styles.finalMessageText}>
              Your information is used to create and personalize your Atua
              profile.
            </Text>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* ======================================================
            SAVE FOOTER
        ====================================================== */}

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, uploading && styles.saveButtonDisabled]}
            disabled={uploading}
            onPress={handleSave}
            activeOpacity={0.86}
            accessibilityRole="button"
            accessibilityLabel="Save profile"
          >
            {uploading ? (
              <View style={styles.savingState}>
                <ActivityIndicator size="small" color="#FFFFFF" />

                <View style={styles.savingTextContainer}>
                  <Text style={styles.saveButtonLabel}>Saving profile...</Text>

                  <Text style={styles.saveButtonSubLabel}>
                    {uploadProgress > 0
                      ? `${uploadProgress}% uploaded`
                      : "Please wait"}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.saveButtonTextContainer}>
                  <Text style={styles.saveButtonLabel}>Save Profile</Text>

                  <Text style={styles.saveButtonSubLabel}>
                    Complete your profile
                  </Text>
                </View>

                <View style={styles.saveButtonIconContainer}>
                  <Ionicons
                    name="checkmark"
                    size={22}
                    style={styles.saveButtonIcon}
                  />
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ReviewUserCom;
