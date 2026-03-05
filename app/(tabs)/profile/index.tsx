import { useAuthContext } from "@/providers/AuthProvider";
import React from "react";
import { View } from "react-native";
import EditProfile from "../../../components/ProfileComs/EditProfile";
import MainProfile from "../../../components/ProfileComs/MainProfile";

const ProfilePage = () => {
  const { dbUser } = useAuthContext();

  return (
    <View style={{ flex: 1 }}>
      {/* Note that its mainprofile thats meant to be here */}
      {dbUser ? <MainProfile /> : <EditProfile />}
    </View>
  );
};

export default ProfilePage;
