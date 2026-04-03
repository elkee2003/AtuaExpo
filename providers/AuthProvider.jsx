import { User } from "@/src/models";
import { getCurrentUser, signOut } from "aws-amplify/auth";
import { DataStore } from "aws-amplify/datastore";
import { Hub } from "aws-amplify/utils";
import { router } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";

const waitForDataStoreReady = () => {
  return new Promise((resolve) => {
    const unsubscribe = Hub.listen("datastore", ({ payload }) => {
      if (payload.event === "ready") {
        unsubscribe(); // stop listening
        resolve();
      }
    });
  });
};

const AuthContext = createContext({});

const AuthProvider = ({ children }) => {
  // Amplify states
  const [authUser, setAuthUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [sub, setSub] = useState(null);
  const [userMail, setUserMail] = useState(null);

  // ✅ Function to handle full logout and cleanup
  const handleUserDeleted = async () => {
    console.log("User deleted from Cognito — clearing session...");
    try {
      await signOut({ global: true }); // clears all sessions
      await DataStore.clear(); // clears cached data
      await DataStore.start();
    } catch (err) {
      console.log("Error clearing session:", err);
    } finally {
      setAuthUser(null);
      setDbUser(null);
      setSub(null);
      router.push("/login"); // navigate back to login
    }
  };

  // Functions for useEffect
  const currentAuthenticatedUser = async () => {
    try {
      const user = await getCurrentUser();
      setAuthUser(user);
      // const subId = authUser?.userId;
      // setSub(subId);
      setSub(user.userId);
      const email = authUser?.signInDetails?.loginId;
      setUserMail(email);
    } catch (err) {
      console.log("Auth check failed:", err.name);

      // Handle deleted / invalid / expired user session
      if (
        err.name === "UserNotFoundException" ||
        err.name === "NotAuthorizedException" ||
        err.name === "InvalidSignatureException"
      ) {
        await handleUserDeleted();
      }
    }
  };

  const dbCurrentUser = async () => {
    if (!sub) return;

    try {
      await waitForDataStoreReady(); // 🔥 THIS is the fix

      const users = await DataStore.query(User, (u) => u.sub.eq(sub));

      if (users.length > 0) {
        setDbUser(users[0]);
      } else {
        setDbUser(null);
      }
    } catch (error) {
      console.error("Error getting dbuser: ", error);
    }
  };

  useEffect(() => {
    currentAuthenticatedUser();
  }, [sub]);

  useEffect(() => {
    const listener = (data) => {
      const { event } = data.payload;
      if (event === "signedIn") {
        currentAuthenticatedUser();
      } else if (event === "signedOut") {
        setAuthUser(null); // Clear the authUser state
        setSub(null); // Clear the sub state
        router.push("/login"); // Navigate to the sign-in page
      }
    };

    // Start listening for authentication events
    const hubListener = Hub.listen("auth", listener);

    // Cleanup the listener when the component unmounts
    return () => hubListener(); // Stop listening for the events
  }, []);

  useEffect(() => {
    if (sub) {
      dbCurrentUser();
    }
  }, [sub]);

  // Set up a subscription to listen to changes on the current user's User instance
  useEffect(() => {
    if (!dbUser) return;

    const subscription = DataStore.observe(User, dbUser.id).subscribe(
      ({ element, opType }) => {
        if (opType === "UPDATE") {
          setDbUser(element);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [dbUser]);

  useEffect(() => {
    if (!dbUser) return;

    // Observe for deletion of the Realtor record
    const deleteSubscription = DataStore.observe(User).subscribe(
      async ({ element, opType }) => {
        if (opType === "DELETE" && element.id === dbUser.id) {
          await DataStore.clear();
          setDbUser(null); // Clear dbUser when the record is deleted
        }
      },
    );

    return () => deleteSubscription.unsubscribe();
  }, [dbUser]);

  return (
    <AuthContext.Provider
      value={{
        authUser,
        dbUser,
        setDbUser,
        sub,
        userMail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
export const useAuthContext = () => useContext(AuthContext);
