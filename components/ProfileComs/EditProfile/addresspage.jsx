import { GOOGLE_API_KEY } from "@/keys";
import { Ionicons } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { SafeAreaView } from "react-native-safe-area-context";

import { useProfileContext } from "../../../providers/ProfileProvider";
import styles from "./styles";

const AddressPage = () => {
  const [isFocused, setIsFocused] = useState(false);

  const autocompleteRef = useRef(null);

  const {
    exactAddress,
    setExactAddress,
    address,
    setAddress,
    setLat,
    setLng,
    errorMessage,
    onValidateAddressInput,
  } = useProfileContext();

  // ============================================================
  // GOOGLE PLACES FOCUS STATE
  // ============================================================

  const handleFocusChange = (focused) => {
    setIsFocused(focused);
  };

  // ============================================================
  // GOOGLE PLACE SELECTION
  // ============================================================

  const handlePlaceSelect = (data, details = null) => {
    // Get the selected address.
    const selectedAddress = data?.description || details?.formatted_address;

    // Get coordinates from Google Places details.
    const selectedLat = details?.geometry?.location?.lat;
    const selectedLng = details?.geometry?.location?.lng;

    // Make sure a valid address was selected.
    if (!selectedAddress) {
      return;
    }

    console.log("Selected address:", selectedAddress);
    console.log("Latitude:", selectedLat);
    console.log("Longitude:", selectedLng);

    // Save selected address.
    setAddress(selectedAddress);

    // Save latitude.
    if (selectedLat !== undefined && selectedLat !== null) {
      setLat(String(selectedLat));
    }

    // Save longitude.
    if (selectedLng !== undefined && selectedLng !== null) {
      setLng(String(selectedLng));
    }

    // Close the focused state after selecting a result.
    setIsFocused(false);
  };

  // ============================================================
  // CLEAR GOOGLE ADDRESS
  // ============================================================

  const handleClearAddress = () => {
    // Clear the Google Places input.
    autocompleteRef.current?.clear();

    // Clear selected address.
    setAddress(null);

    // Clear coordinates.
    setLat(null);
    setLng(null);

    // Reset focus state.
    setIsFocused(false);
  };

  // ============================================================
  // NEXT PAGE
  // ============================================================

  const handleNxtPage = () => {
    if (onValidateAddressInput()) {
      router.push("/profile/reviewprofile");
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
      >
        <View style={styles.container}>
          {/* ==================================================
              HEADER
          ================================================== */}

          <View style={styles.header}>
            {/* Back button */}
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerIconButton}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={21} style={styles.headerIcon} />
            </TouchableOpacity>

            {/* Header title */}
            <View style={styles.headerCenter}>
              <Text style={styles.title}>Your Address</Text>

              <Text style={styles.headerSubtitle}>
                Where should we associate your profile?
              </Text>
            </View>

            {/* Step indicator */}
            <View style={styles.stepIndicator}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepTotal}>/ 3</Text>
            </View>
          </View>

          {/* ==================================================
              PROGRESS
          ================================================== */}

          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>

            <View style={styles.progressLabels}>
              <Text style={styles.progressText}>Profile</Text>

              <Text style={styles.progressTextActive}>Address</Text>

              <Text style={styles.progressText}>Review</Text>
            </View>
          </View>

          {/* ==================================================
              CONTENT
              
              IMPORTANT:
              No ScrollView here.

              GooglePlacesAutocomplete contains its own
              VirtualizedList. Keeping this section outside
              a ScrollView prevents the nested VirtualizedList
              warning.
          ================================================== */}

          <View style={styles.addressContent}>
            {/* ==================================================
                EXACT ADDRESS
            ================================================== */}

            <View style={styles.section}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldNumber}>
                  <Text style={styles.fieldNumberText}>01</Text>
                </View>

                <View style={styles.fieldHeaderText}>
                  <Text style={styles.fieldTitle}>Exact address</Text>

                  <Text style={styles.fieldSubtitle}>
                    Enter the address as you know it
                  </Text>
                </View>
              </View>

              {/* Exact address input */}
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="home-outline"
                  size={20}
                  style={styles.inputIcon}
                />

                <TextInput
                  value={exactAddress}
                  onChangeText={setExactAddress}
                  placeholder="e.g. 15 Stadium Road"
                  placeholderTextColor="#8B93A1"
                  style={styles.input}
                  autoCapitalize="words"
                  autoCorrect={false}
                  multiline
                  textAlignVertical="center"
                  selectionColor="#07A830"
                />
              </View>

              <Text style={styles.fieldHint}>
                Include your house number, street and any useful identifying
                details.
              </Text>
            </View>

            {/* ==================================================
                GOOGLE MAPS ADDRESS
            ================================================== */}

            <View style={styles.section}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldNumber}>
                  <Text style={styles.fieldNumberText}>02</Text>
                </View>

                <View style={styles.fieldHeaderText}>
                  <Text style={styles.fieldTitle}>Confirm location</Text>

                  <Text style={styles.fieldSubtitle}>
                    Select your address from Google Maps
                  </Text>
                </View>
              </View>

              {/* =================================================
                  GOOGLE PLACES WRAPPER
              ================================================= */}

              <View
                style={
                  isFocused
                    ? styles.googleContainerFocused
                    : styles.googleContainer
                }
              >
                <GooglePlacesAutocomplete
                  key="profile-address-autocomplete"
                  debounce={300}
                  fetchDetails
                  ref={autocompleteRef}
                  placeholder="Search for your address"
                  onPress={handlePlaceSelect}
                  enablePoweredByContainer={false}
                  nearbyPlacesAPI="GooglePlacesSearch"
                  textInputProps={{
                    placeholderTextColor: "#8B93A1",

                    onFocus: () => handleFocusChange(true),

                    onBlur: () => handleFocusChange(false),

                    autoCorrect: false,

                    autoCapitalize: "none",

                    selectionColor: "#07A830",
                  }}
                  styles={{
                    container: styles.googleAutocompleteContainer,

                    textInputContainer: styles.googleTextInputContainer,

                    textInput: styles.googleTextInput,

                    listView: styles.googleListView,

                    row: styles.googleRow,

                    description: styles.googleDescription,

                    separator: styles.googleSeparator,

                    poweredContainer: styles.gPoweredContainer,
                  }}
                  renderRow={(data) => (
                    <View style={styles.googleResultRow}>
                      {/* Result icon */}
                      <View style={styles.googleResultIcon}>
                        <Ionicons
                          name="location-outline"
                          size={17}
                          style={styles.googleResultIconGlyph}
                        />
                      </View>

                      {/* Result text */}
                      <View style={styles.googleResultText}>
                        <Text
                          style={styles.googleResultDescription}
                          numberOfLines={2}
                        >
                          {data?.description}
                        </Text>
                      </View>
                    </View>
                  )}
                  query={{
                    key: GOOGLE_API_KEY,
                    language: "en",
                    components: "country:ng",
                  }}
                />

                {/* =================================================
                    CLEAR BUTTON
                ================================================= */}

                <TouchableOpacity
                  onPress={handleClearAddress}
                  style={styles.clearIconContainer}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Clear selected address"
                >
                  <Ionicons
                    name="close-circle"
                    size={21}
                    style={styles.clearIcon}
                  />
                </TouchableOpacity>
              </View>

              {/* =================================================
                  LOCATION HINT
              ================================================= */}

              <View style={styles.locationHint}>
                <Ionicons
                  name="information-circle-outline"
                  size={15}
                  style={styles.locationHintIcon}
                />

                <Text style={styles.locationHintText}>
                  Selecting a result helps us save the correct map coordinates
                  for your location.
                </Text>
              </View>
            </View>

            {/* ==================================================
                SELECTED ADDRESS PREVIEW
            ================================================== */}

            {address ? (
              <View style={styles.selectedAddressCard}>
                {/* Header */}
                <View style={styles.selectedAddressHeader}>
                  <View style={styles.selectedAddressIcon}>
                    <Ionicons
                      name="checkmark"
                      size={16}
                      style={styles.selectedAddressCheck}
                    />
                  </View>

                  <View style={styles.selectedAddressHeaderText}>
                    <Text style={styles.selectedAddressTitle}>
                      Location selected
                    </Text>

                    <Text style={styles.selectedAddressSubtitle}>
                      Google Maps location confirmed
                    </Text>
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.selectedAddressDivider} />

                {/* Selected address */}
                <View style={styles.selectedAddressBody}>
                  <Ionicons
                    name="location"
                    size={18}
                    style={styles.selectedAddressLocationIcon}
                  />

                  <Text style={styles.selectedAddressText}>{address}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.locationEmptyCard}>
                <View style={styles.emptyLocationIcon}>
                  <Ionicons
                    name="map-outline"
                    size={24}
                    style={styles.emptyLocationIconGlyph}
                  />
                </View>

                <View style={styles.emptyLocationText}>
                  <Text style={styles.emptyLocationTitle}>
                    Location not selected yet
                  </Text>

                  <Text style={styles.emptyLocationSubtitle}>
                    Search above and choose the correct address.
                  </Text>
                </View>
              </View>
            )}

            {/* ==================================================
                ERROR
            ================================================== */}

            {!!errorMessage && (
              <View style={styles.errorContainer}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  style={styles.errorIcon}
                />

                <Text style={styles.error}>{errorMessage}</Text>
              </View>
            )}
          </View>

          {/* ==================================================
              FOOTER / NEXT BUTTON
          ================================================== */}

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleNxtPage}
              style={styles.nextButton}
              activeOpacity={0.86}
              accessibilityRole="button"
              accessibilityLabel="Continue to profile review"
            >
              <View style={styles.nextButtonTextContainer}>
                <Text style={styles.nextButtonLabel}>Continue</Text>

                <Text style={styles.nextButtonSubLabel}>
                  Review your profile
                </Text>
              </View>

              <View style={styles.nextButtonIconContainer}>
                <MaterialIcons
                  name="arrow-forward"
                  size={23}
                  style={styles.nextButtonIcon}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AddressPage;
