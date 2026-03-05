import { resetPassword } from "aws-amplify/auth";
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

import CustomButton from "../customButtons";
import CustomInput from "../customInput";
import styles from "./styles";

const ForgotPasswordCom = () => {
  const { control, handleSubmit } = useForm();
  const [loading, setLoading] = useState(false);

  const onSubmit = async ({ email }) => {
    if (loading) return;
    setLoading(true);

    try {
      await resetPassword({ username: email });

      Alert.alert("Success", "Code sent to your email.");
      router.push({
        pathname: "/login/confirmcode",
        params: { email },
      });
    } catch (e) {
      Alert.alert("Error", e.message);
    }

    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your email to receive a reset code
            </Text>
          </View>

          <View style={styles.card}>
            <CustomInput
              name="email"
              control={control}
              placeholder="Enter your email"
              inputSub="Email"
              rules={{
                required: "Email is required",
                pattern: {
                  value: /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/,
                  message: "Invalid email format",
                },
              }}
            />

            <CustomButton
              text="Send Code"
              onPress={handleSubmit(onSubmit)}
              loading={loading}
            />

            <Text style={styles.link} onPress={() => router.push("/login")}>
              Back to Sign In
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ForgotPasswordCom;
