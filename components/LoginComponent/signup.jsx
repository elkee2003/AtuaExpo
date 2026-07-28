import AsyncStorage from "@react-native-async-storage/async-storage";
import { signUp } from "aws-amplify/auth";
import Checkbox from "expo-checkbox";
import { router } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomButton from "./customButtons";
import CustomInput from "./customInput";
import styles from "./styles";

const SignUp = () => {
  const { control, handleSubmit, getValues } = useForm();
  const [loading, setLoading] = useState(false);
  const [agree, setAgree] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);

  const role = "user";

  const onSignUp = async (data) => {
    if (!agree) {
      Alert.alert("Please agree to terms.");
      return;
    }

    setLoading(true);

    try {
      const email = data.email.trim().toLowerCase();
      await signUp({
        username: email,
        password: data.password,
        options: {
          userAttributes: {
            email: email,
            "custom:role": role,
          },
          autoSignIn: true,
        },
      });

      // Save email locally
      await AsyncStorage.setItem("pendingVerificationEmail", email);

      router.push({
        pathname: "/login/confirmemail",
        params: { username: email },
      });
    } catch (error) {
      Alert.alert("Sign Up Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        // keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join Atua Logistics</Text>
          </View>

          <View style={styles.formCard}>
            <CustomInput
              control={control}
              name="email"
              label="Email"
              placeholder="Enter your email"
              rules={{
                required: "Email is required",
                // I commented it out because with the format of.trim(), it will automatically remove the white space
                // pattern: {
                //   value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                //   message: "Enter a valid email",
                // },
              }}
            />

            <CustomInput
              control={control}
              name="password"
              label="Password"
              placeholder="Create password"
              secureTextEntry={!isPasswordVisible}
              isPassword
              isVisible={isPasswordVisible}
              setIsVisible={setIsPasswordVisible}
              rules={{
                required: "Password is required",
                minLength: {
                  value: 8,
                  message: "Minimum 8 characters",
                },
              }}
            />

            <CustomInput
              control={control}
              name="confirmPassword"
              label="Confirm Password"
              placeholder="Repeat password"
              secureTextEntry={!isConfirmVisible}
              isPassword
              isVisible={isConfirmVisible}
              setIsVisible={setIsConfirmVisible}
              rules={{
                validate: (value) =>
                  value === getValues("password") || "Passwords do not match",
              }}
            />

            <View style={styles.checkboxRow}>
              <Checkbox value={agree} onValueChange={setAgree} />
              <Text style={styles.checkboxText}>
                I agree to the Terms and Privacy Policy
              </Text>
            </View>

            <CustomButton
              text="Create Account"
              onPress={handleSubmit(onSignUp)}
              loading={loading}
            />

            <Text
              style={styles.secondaryText}
              onPress={() => router.push("/login")}
            >
              Already have an account? Sign In
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignUp;

// Thanks to the async storage:
// User signs up → email saved.
// User leaves app → email still saved.
// Android kills app → email still saved.
// User comes back → verification screen still knows the email.
// User tries signing in before verifying → app sends them straight back to the verification screen without losing the email.
