import { User } from "@/src/models";
import { getCurrentUser, signOut } from "aws-amplify/auth";
import { DataStore } from "aws-amplify/datastore";
import { Hub } from "aws-amplify/utils";
import { router } from "expo-router";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const AuthContext = createContext({});

const AuthProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [sub, setSub] = useState(null);
  const [userMail, setUserMail] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const authRequestRef = useRef(0);
  const loadRequestRef = useRef(0);

  // ============================================================
  // CLEAR USER SESSION
  // ============================================================

  const clearUserSession = () => {
    authRequestRef.current += 1;
    loadRequestRef.current += 1;

    setAuthUser(null);
    setDbUser(null);
    setSub(null);
    setUserMail(null);
    setLoadingUser(false);
  };

  // ============================================================
  // HANDLE DELETED / INVALID USER
  // ============================================================

  const handleUserDeleted = async () => {
    console.log("User deleted or session invalid. Clearing session...");

    try {
      await signOut({ global: true });
    } catch (error) {
      console.log("Sign-out cleanup:", error);
    }

    try {
      await DataStore.clear();
      await DataStore.start();
    } catch (error) {
      console.log("Error clearing DataStore:", error);
    } finally {
      clearUserSession();
      router.replace("/login");
    }
  };

  // ============================================================
  // GET CURRENT AUTHENTICATED USER
  // ============================================================

  const currentAuthenticatedUser = async () => {
    const requestId = ++authRequestRef.current;

    try {
      const user = await getCurrentUser();

      if (requestId !== authRequestRef.current) return;

      setAuthUser(user);
      setSub(user.userId);

      const email = user?.signInDetails?.loginId ?? null;
      setUserMail(email);
    } catch (error) {
      if (requestId !== authRequestRef.current) return;

      console.log("Auth check failed:", error?.name);

      if (
        error?.name === "UserNotFoundException" ||
        error?.name === "NotAuthorizedException" ||
        error?.name === "InvalidSignatureException"
      ) {
        await handleUserDeleted();
      } else {
        clearUserSession();
      }
    }
  };

  // ============================================================
  // INITIAL AUTHENTICATION CHECK
  // ============================================================

  useEffect(() => {
    currentAuthenticatedUser();
  }, []);

  // ============================================================
  // LISTEN FOR AUTHENTICATION EVENTS
  // ============================================================

  useEffect(() => {
    const handleSignOutEvent = async () => {
      clearUserSession();

      try {
        await DataStore.clear();
        await DataStore.start();
      } catch (error) {
        console.log("Error clearing DataStore after sign-out:", error);
      }

      router.replace("/login");
    };

    const listener = ({ payload }) => {
      const { event } = payload;

      if (event === "signedIn") {
        currentAuthenticatedUser();
      } else if (event === "signedOut") {
        handleSignOutEvent();
      }
    };

    const hubListener = Hub.listen("auth", listener);

    return () => {
      hubListener();
    };
  }, []);

  // ============================================================
  // LOAD AND OBSERVE DATABASE USER
  // ============================================================

  useEffect(() => {
    if (!sub) {
      setDbUser(null);
      setLoadingUser(false);
      return;
    }

    const currentRequestId = ++loadRequestRef.current;

    let subscription;

    setLoadingUser(true);
    setDbUser(null);

    subscription = DataStore.observeQuery(User, (user) =>
      user.sub.eq(sub),
    ).subscribe({
      next: ({ items, isSynced }) => {
        if (currentRequestId !== loadRequestRef.current) return;

        if (items.length > 0) {
          setDbUser(items[0]);
        } else if (isSynced) {
          setDbUser(null);
        }

        if (isSynced) {
          setLoadingUser(false);
        }
      },

      error: (error) => {
        if (currentRequestId !== loadRequestRef.current) return;

        console.error("Error observing database user:", error);
        setLoadingUser(false);
      },
    });

    return () => {
      if (loadRequestRef.current === currentRequestId) {
        loadRequestRef.current += 1;
      }

      subscription?.unsubscribe();
    };
  }, [sub, refreshVersion]);

  // ============================================================
  // REFRESH USER
  // ============================================================

  const refreshUser = async () => {
    console.log("Manual user refresh triggered");

    if (!sub) {
      setLoadingUser(false);
      return;
    }

    try {
      setLoadingUser(true);

      await DataStore.clear();
      await DataStore.start();

      setRefreshVersion((previous) => previous + 1);
    } catch (error) {
      console.error("User refresh error:", error);
      setLoadingUser(false);
    }
  };

  // ============================================================
  // ⚠️ TEMPORARY LOCAL DATASTORE RESET
  // ============================================================
  // RUN THIS ONCE.
  //
  // It clears the DataStore database stored locally
  // on THIS DEVICE.
  //
  // It does NOT delete records from AWS/AppSync/Data Manager.
  //
  // After you see:
  //
  //   🧹 LOCAL DATASTORE CLEARED
  //
  // COMMENT OUT THIS ENTIRE useEffect.
  // ============================================================

  // useEffect(() => {
  //   const resetLocalDataStore = async () => {
  //     try {
  //       console.log("==========================================");
  //       console.log("🧹 CLEARING LOCAL DATASTORE...");
  //       console.log("==========================================");

  //       await DataStore.clear();

  //       console.log("🧹 LOCAL DATASTORE CLEARED");

  //       await DataStore.start();

  //       console.log("✅ DATASTORE RESTARTED");

  //       console.log("==========================================");
  //       console.log("🧹 LOCAL DATASTORE RESET COMPLETE");
  //       console.log("==========================================");
  //     } catch (error) {
  //       console.error("❌ FAILED TO CLEAR LOCAL DATASTORE:", error);
  //     }
  //   };

  //   resetLocalDataStore();
  // }, []);

  // ============================================================
  // AUTH CONTEXT
  // ============================================================

  return (
    <AuthContext.Provider
      value={{
        authUser,
        dbUser,
        setDbUser,
        sub,
        userMail,
        loadingUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;

export const useAuthContext = () => useContext(AuthContext);
