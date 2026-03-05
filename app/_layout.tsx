import ProfileProvider from "@/providers/ProfileProvider";
import { Amplify } from "aws-amplify";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AuthProvider from "../providers/AuthProvider";
import LocationProvider from "../providers/LocationProvider";
import OrderProvider from "../providers/OrderProvider";
import amplifyconfig from "../src/amplifyconfiguration.json";

Amplify.configure(amplifyconfig);

const RootLayout = () => {
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
