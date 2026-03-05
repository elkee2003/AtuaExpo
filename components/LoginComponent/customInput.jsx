import { Ionicons } from "@expo/vector-icons";
import { Controller } from "react-hook-form";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import styles from "./styles";

const CustomInput = ({
  control,
  name,
  rules = {},
  label,
  placeholder,
  secureTextEntry,
  isPassword,
  isVisible,
  setIsVisible,
}) => {
  return (
    <View style={styles.inputWrapper}>
      <Text style={styles.inputLabel}>{label}</Text>

      <Controller
        control={control}
        name={name}
        defaultValue=""
        rules={rules}
        render={({
          field: { onChange, onBlur, value },
          fieldState: { error },
        }) => (
          <>
            <View style={styles.inputContainer}>
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={placeholder}
                placeholderTextColor="#94A3B8"
                secureTextEntry={secureTextEntry}
                autoCapitalize="none"
                style={[styles.input, error && styles.errorBorder]}
              />

              {isPassword && (
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setIsVisible(!isVisible)}
                >
                  <Ionicons
                    name={isVisible ? "eye" : "eye-off"}
                    size={22}
                    color="#64748B"
                  />
                </TouchableOpacity>
              )}
            </View>

            {error && <Text style={styles.errorText}>{error.message}</Text>}
          </>
        )}
      />
    </View>
  );
};

export default CustomInput;
