import { useAuthContext } from "@/providers/AuthProvider";
import { User } from "@/src/models";
import { Ionicons } from "@expo/vector-icons";
import { signOut } from "aws-amplify/auth";
import { DataStore } from "aws-amplify/datastore";
import { getUrl } from "aws-amplify/storage";
import { router } from "expo-router";

import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Placeholder from "../../../assets/images/placeholder.png";
import { useProfileContext } from "../../../providers/ProfileProvider";
import styles from "./styles";

const MainProfile = ({ onRefresh, refreshing }) => {
  const {
    firstName,
    lastName,
    address,
    phoneNumber,
    setProfilePic,
    profilePic,
  } = useProfileContext();

  const { dbUser } = useAuthContext();

  const [loading, setLoading] = useState(true);

  // Fetch signed URL for profile picture
  const fetchImageUrl = async () => {
    setLoading(true);

    if (!dbUser?.profilePic) {
      // If profilePic is not available, use the placeholder
      setProfilePic(null);
      setLoading(false);
      return;
    }

    try {
      const result = await getUrl({
        path: dbUser.profilePic,
        options: {
          validateObjectExistence: true,
          expiresIn: null, // No expiration limit
        },
      });

      if (result.url) {
        setProfilePic(result?.url.toString());
      } else {
        setProfilePic(null); // Fallback to null if no URL is returned
      }
    } catch (error) {
      console.log("Error fetching profile pic URL:", error);
      setProfilePic(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!dbUser?.profilePic || dbUser.profilePic.trim() === "") {
      return;
    }

    fetchImageUrl();

    const subscription = DataStore.observe(User).subscribe(({ opType }) => {
      if (opType === "INSERT" || opType === "UPDATE" || opType === "DELETE") {
        fetchImageUrl();
      }
    });

    return () => subscription.unsubscribe();
  }, [dbUser.profilePic]);

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      console.log("error signing out: ", error);
    }
  }

  const onSignout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Yes",
          onPress: () => handleSignOut(),
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#111" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Profile</Text>

        <TouchableOpacity onPress={onSignout}>
          <Ionicons name="log-out-outline" size={26} color="#E53935" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            {loading || !profilePic ? (
              <Image source={Placeholder} style={styles.avatar} />
            ) : (
              <Image
                source={{ uri: profilePic }}
                style={styles.avatar}
                onError={() => setProfilePic(null)}
              />
            )}
          </View>

          <Text style={styles.name}>
            {firstName} {lastName}
          </Text>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color="#555" />
            <Text style={styles.infoText}>{phoneNumber}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color="#555" />
            <Text style={styles.infoText}>{address}</Text>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/profile/editprofile")}
          >
            <Text style={styles.primaryButtonText}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push("/profile/reviewinfo")}
          >
            <Text style={styles.secondaryButtonText}>View Information</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default MainProfile;
