import { Stack } from "expo-router";
import AuthProvider from '../providers/AuthProvider'
import OrderProvider from '../providers/OrderProvider'
import LocationProvider from '../providers/LocationProvider'
import ProfileProvider from "@/providers/ProfileProvider";

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <OrderProvider>
          <LocationProvider>
            <Stack screenOptions={{
              headerShown:false
            }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </LocationProvider>
        </OrderProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
