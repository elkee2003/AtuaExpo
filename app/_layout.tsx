import ProfileProvider from "@/providers/ProfileProvider";
import { resumePendingUploads } from "@/utils/resumePendingUploads";
import { uploadEvidence } from "@/utils/uploadEvidence";

import { Amplify } from "aws-amplify";
import { Stack } from "expo-router";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import {
  PaystackProvider,
} from "react-native-paystack-webview";

import AuthProvider from "../providers/AuthProvider";
import LocationProvider from "../providers/LocationProvider";
import OrderProvider from "../providers/OrderProvider";

import amplifyconfig from "../src/amplifyconfiguration.json";

//-----------------------------------------
// Amplify Configuration
//-----------------------------------------

Amplify.configure(amplifyconfig);

//-----------------------------------------
// Paystack Public Key
//-----------------------------------------

// TEST PUBLIC KEY ONLY FOR NOW.
//-----------------------------------------

const PAYSTACK_PUBLIC_KEY =
  "pk_test_02c242878c00dfec3ba77ac909a90b2f56c938b3";

//-----------------------------------------
// Root Layout
//-----------------------------------------

const RootLayout = () => {
  //-----------------------------------------
  // Resume Pending Uploads
  //-----------------------------------------

  useEffect(() => {
    resumePendingUploads(
      uploadEvidence,
    );
  }, []);

  //-----------------------------------------
  // Render
  //-----------------------------------------

  return (
    <GestureHandlerRootView
      style={{ flex: 1 }}
    >
      <PaystackProvider
        publicKey={
          PAYSTACK_PUBLIC_KEY
        }
        currency="NGN"
        debug={true}
      >
        <AuthProvider>
          <ProfileProvider>
            <OrderProvider>
              <LocationProvider>
                <Stack
                  screenOptions={{
                    headerShown:
                      false,
                  }}
                >
                  <Stack.Screen
                    name="(tabs)"
                  />
                </Stack>
              </LocationProvider>
            </OrderProvider>
          </ProfileProvider>
        </AuthProvider>
      </PaystackProvider>
    </GestureHandlerRootView>
  );
};

export default RootLayout;