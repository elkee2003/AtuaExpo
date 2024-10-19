import { Text, View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { getCurrentUser, AuthUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

export default function Index() {

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true);

  const checkUser = async () =>{
    try{
      const authUser = await getCurrentUser();
      setUser(authUser);
    }catch(e){
      console.log('This is the error:', e)
    }finally {
      setLoading(false);
    }
  }

  useEffect(()=>{
    checkUser()
  },[checkUser])

  useEffect(()=>{

    const listener = data =>{
      const { event } = data.payload;
      if (event === 'signedIn' || event === 'signedOut'){
        checkUser();
      }
    }

    // Start listening for authentication events
    const hubListener = Hub.listen('auth', listener);

    // Cleanup the listener when the component unmounts
    return () => hubListener(); // Stop listening for the events
  },[checkUser])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading...</Text>
      </View>
    );
  }

  return user ? <Redirect href="/profile" /> :  <Redirect href="/login" />;
}
