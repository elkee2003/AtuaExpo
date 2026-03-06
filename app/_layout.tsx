import ProfileProvider from "@/providers/ProfileProvider";
import { resumePendingUploads } from "@/utils/resumePendingUploads";
import { uploadEvidence } from "@/utils/uploadEvidence";
import { Amplify } from "aws-amplify";
import { Stack } from "expo-router";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AuthProvider from "../providers/AuthProvider";
import LocationProvider from "../providers/LocationProvider";
import OrderProvider from "../providers/OrderProvider";
import amplifyconfig from "../src/amplifyconfiguration.json";

Amplify.configure(amplifyconfig);

const RootLayout = () => {
  useEffect(() => {
    resumePendingUploads(uploadEvidence);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ProfileProvider>
          <OrderProvider>
            <LocationProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                }}
              >
                <Stack.Screen name="(tabs)" />
              </Stack>
            </LocationProvider>
          </OrderProvider>
        </ProfileProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
};

export default RootLayout;
