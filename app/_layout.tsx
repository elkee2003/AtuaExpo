import { Stack } from "expo-router";
import AuthProvider from '../providers/AuthProvider'
import OrderProvider from '../providers/OrderProvider'
import LocationProvider from '../providers/LocationProvider'
import ProfileProvider from "@/providers/ProfileProvider";
import {
  withAuthenticator,
  useAuthenticator
} from '@aws-amplify/ui-react-native';
import { Amplify } from 'aws-amplify';
import amplifyconfig from '../src/amplifyconfiguration.json'

Amplify.configure(amplifyconfig);

const RootLayout = () => {
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


export default RootLayout;
