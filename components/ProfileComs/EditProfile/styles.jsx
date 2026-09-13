import { Platform, StyleSheet } from "react-native";

const styles = StyleSheet.create({
  // ============================================================
  // 1. GLOBAL / SHARED SCREEN STYLES
  // Used by: EditProfile, AddressPage, ReviewUserCom
  // ============================================================

  screen: {
    flex: 1,
    backgroundColor: "#F5F5F3",
  },

  container: {
    flex: 1,
    backgroundColor: "#F5F5F3",
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 30,
  },

  bottomSpacer: {
    height: 30,
  },

  // ============================================================
  // 2. SHARED HEADER
  // Used by all three screens
  // ============================================================

  header: {
    minHeight: 76,

    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,

    flexDirection: "row",
    alignItems: "center",

    backgroundColor: "#FFFFFF",

    borderBottomWidth: 1,
    borderBottomColor: "#E7E7E4",
  },

  headerIconButton: {
    width: 42,
    height: 42,

    borderRadius: 21,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#F0F0EE",
  },

  headerIcon: {
    color: "#111111",
  },

  headerCenter: {
    flex: 1,
    marginHorizontal: 13,
  },

  title: {
    fontSize: 20,
    fontWeight: "800",

    color: "#111111",

    letterSpacing: -0.35,
  },

  headerSubtitle: {
    marginTop: 3,

    fontSize: 11,
    fontWeight: "500",

    color: "#777777",

    lineHeight: 15,
  },

  stepIndicator: {
    minWidth: 43,
    height: 34,

    paddingHorizontal: 8,

    borderRadius: 17,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#171717",
  },

  stepNumber: {
    fontSize: 14,
    fontWeight: "800",

    color: "#FFFFFF",
  },

  stepTotal: {
    fontSize: 11,
    fontWeight: "600",

    color: "#A7A7A7",

    marginLeft: 2,
  },

  // ============================================================
  // 3. PROGRESS INDICATOR
  // Used by: AddressPage, ReviewUserCom
  // ============================================================

  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 13,

    backgroundColor: "#FFFFFF",
  },

  progressTrack: {
    height: 4,
    width: "100%",

    overflow: "hidden",

    borderRadius: 4,

    backgroundColor: "#E5E5E2",
  },

  progressFill: {
    height: "100%",
    width: "66.66%",

    borderRadius: 4,

    backgroundColor: "#151515",
  },

  progressFillComplete: {
    height: "100%",
    width: "100%",

    borderRadius: 4,

    backgroundColor: "#151515",
  },

  progressLabels: {
    marginTop: 7,

    flexDirection: "row",
    justifyContent: "space-between",
  },

  progressText: {
    fontSize: 9,
    fontWeight: "600",

    color: "#999999",
  },

  progressTextActive: {
    fontSize: 9,
    fontWeight: "800",

    color: "#111111",
  },

  // ============================================================

  // ============================================================
  // 5. EDIT PROFILE — PROFILE PHOTO
  // Used by: EditProfile
  // ============================================================

  photoSection: {
    alignItems: "center",

    paddingVertical: 20,

    marginTop: 5,
    marginBottom: 8,

    backgroundColor: "#FFFFFF",

    borderRadius: 22,

    borderWidth: 1,
    borderColor: "#E4E4E1",
  },

  profilePicContainer: {
    width: 132,
    height: 132,

    borderRadius: 66,

    alignItems: "center",
    justifyContent: "center",

    position: "relative",

    backgroundColor: "#E8E8E5",

    borderWidth: 4,
    borderColor: "#FFFFFF",

    shadowColor: "#000000",

    shadowOffset: {
      width: 0,
      height: 7,
    },

    shadowOpacity: 0.14,
    shadowRadius: 14,

    elevation: 6,
  },

  img: {
    width: "100%",
    height: "100%",

    borderRadius: 66,

    resizeMode: "cover",
  },

  placeholderContainer: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",
  },

  placeholderIconCircle: {
    width: 67,
    height: 67,

    borderRadius: 34,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#DCDCD9",
  },

  placeholderIcon: {
    color: "#666666",
  },

  addPhotoText: {
    marginTop: 7,

    fontSize: 11,
    fontWeight: "700",

    color: "#444444",
  },

  cameraIconContainer: {
    position: "absolute",

    right: -1,
    bottom: 2,

    width: 38,
    height: 38,

    borderRadius: 19,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#111111",

    borderWidth: 3,
    borderColor: "#FFFFFF",

    shadowColor: "#000000",

    shadowOffset: {
      width: 0,
      height: 3,
    },

    shadowOpacity: 0.2,
    shadowRadius: 5,

    elevation: 4,
  },

  cameraIcon: {
    color: "#FFFFFF",
  },

  photoTitle: {
    marginTop: 12,

    fontSize: 13,
    fontWeight: "800",

    color: "#171717",
  },

  photoHint: {
    marginTop: 3,

    fontSize: 10,
    fontWeight: "500",

    color: "#8A8A8A",
  },

  // ============================================================
  // 6. EDIT PROFILE — PERSONAL INFORMATION
  // Used by: EditProfile
  // ============================================================

  section: {
    marginTop: 14,

    padding: 16,

    backgroundColor: "#FFFFFF",

    borderRadius: 20,

    borderWidth: 1,
    borderColor: "#E4E4E1",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",

    marginBottom: 18,
  },

  sectionIcon: {
    width: 38,
    height: 38,

    borderRadius: 12,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#F0F0EE",

    marginRight: 11,
  },

  sectionIconGlyph: {
    color: "#202020",
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",

    color: "#171717",
  },

  sectionSubtitle: {
    marginTop: 2,

    fontSize: 10,
    fontWeight: "500",

    color: "#898989",
  },

  // ============================================================
  // 7. EDIT PROFILE — FORM FIELDS
  // Used by: EditProfile
  // ============================================================

  field: {
    marginBottom: 15,
  },

  fieldLabel: {
    marginBottom: 7,

    fontSize: 11,
    fontWeight: "800",

    color: "#353535",
  },

  inputWrapper: {
    minHeight: 55,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 14,

    backgroundColor: "#F8F8F6",

    borderWidth: 1,
    borderColor: "#DCDCD8",

    borderRadius: 14,
  },

  inputIcon: {
    marginRight: 10,

    color: "#6F6F6F",
  },

  input: {
    flex: 1,

    minHeight: 53,

    paddingVertical: 0,
    paddingHorizontal: 0,

    fontSize: 13,
    fontWeight: "600",

    /*
     * IMPORTANT:
     * Explicit text color keeps entered text visible
     * even when the phone itself is using dark mode.
     */
    color: "#151515",

    backgroundColor: "transparent",
  },

  // ============================================================
  // 8. SHARED ERROR STATE
  // Used by: EditProfile, AddressPage
  // ============================================================

  errorContainer: {
    flexDirection: "row",
    alignItems: "flex-start",

    marginTop: 13,

    paddingHorizontal: 13,
    paddingVertical: 11,

    borderRadius: 13,

    backgroundColor: "#FFF3F3",

    borderWidth: 1,
    borderColor: "#FFD9D9",
  },

  errorIcon: {
    marginTop: 1,
    marginRight: 8,

    color: "#C90707",
  },

  error: {
    flex: 1,

    fontSize: 10,
    lineHeight: 15,

    fontWeight: "600",

    color: "#C90707",
  },

  // ============================================================
  // 9. EDIT PROFILE — FOOTER / NEXT BUTTON
  // Used by: EditProfile
  // ============================================================

  footer: {
    paddingHorizontal: 18,
    paddingTop: 10,

    paddingBottom: Platform.select({
      ios: 20,
      android: 12,
    }),

    backgroundColor: "#F5F5F3",

    borderTopWidth: 1,
    borderTopColor: "#E3E3E0",
  },

  nextButton: {
    minHeight: 64,

    paddingLeft: 19,
    paddingRight: 8,

    borderRadius: 19,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    backgroundColor: "#111111",

    shadowColor: "#000000",

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.16,
    shadowRadius: 9,

    elevation: 5,
  },

  nextButtonTextContainer: {
    flex: 1,
  },

  nextButtonLabel: {
    fontSize: 14,
    fontWeight: "800",

    color: "#FFFFFF",
  },

  nextButtonSubLabel: {
    marginTop: 3,

    fontSize: 9,
    fontWeight: "500",

    color: "#A8A8A8",
  },

  nextButtonIconContainer: {
    width: 47,
    height: 47,

    borderRadius: 15,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#2B2B2B",
  },

  nextButtonIcon: {
    color: "#FFFFFF",
  },

  // ============================================================
  // 9A. ADDRESS PAGE — CONTENT CONTAINER
  // Used only by: AddressPage
  // ============================================================

  addressContent: {
    flex: 1,

    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,

    overflow: "visible",
  },

  // ============================================================
  // 11. ADDRESS PAGE — FIELD HEADERS
  // Used by: AddressPage
  // ============================================================

  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",

    marginBottom: 13,
  },

  fieldNumber: {
    width: 35,
    height: 35,

    borderRadius: 11,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#EFEFEC",

    marginRight: 10,
  },

  fieldNumberText: {
    fontSize: 10,
    fontWeight: "900",

    color: "#222222",
  },

  fieldHeaderText: {
    flex: 1,
  },

  fieldTitle: {
    fontSize: 13,
    fontWeight: "800",

    color: "#1A1A1A",
  },

  fieldSubtitle: {
    marginTop: 2,

    fontSize: 9,
    fontWeight: "500",

    color: "#8A8A8A",
  },

  fieldHint: {
    marginTop: 7,

    fontSize: 9,
    lineHeight: 14,

    fontWeight: "500",

    color: "#8A8A8A",
  },

  // ============================================================
  // 12. ADDRESS PAGE — GOOGLE PLACES
  // Used by: AddressPage
  // ============================================================

  googleContainer: {
    minHeight: 55,

    borderRadius: 14,

    backgroundColor: "#F8F8F6",

    borderWidth: 1,
    borderColor: "#DCDCD8",

    overflow: "visible",

    zIndex: 20,
  },

  googleContainerFocused: {
    minHeight: 55,

    borderRadius: 14,

    backgroundColor: "#F8F8F6",

    borderWidth: 1.5,

    borderColor: "#202020",

    overflow: "visible",

    zIndex: 100,
  },

  googleAutocompleteContainer: {
    flex: 0,
    width: "100%",

    zIndex: 100,
  },

  googleTextInputContainer: {
    height: 53,

    paddingHorizontal: 4,

    backgroundColor: "transparent",

    borderTopWidth: 0,
    borderBottomWidth: 0,
  },

  googleTextInput: {
    height: 51,

    marginTop: 0,
    marginBottom: 0,

    paddingLeft: 13,
    paddingRight: 43,

    fontSize: 13,
    fontWeight: "600",

    /*
     * Explicit text color keeps the Google Places input
     * readable in device dark mode.
     */
    color: "#151515",

    backgroundColor: "transparent",

    borderWidth: 0,
  },

  googleListView: {
    position: "absolute",

    top: 56,
    left: -1,
    right: -1,

    zIndex: 999,

    marginTop: 3,

    backgroundColor: "#FFFFFF",

    borderRadius: 14,

    borderWidth: 1,
    borderColor: "#DEDEDA",

    overflow: "hidden",

    shadowColor: "#000000",

    shadowOffset: {
      width: 0,
      height: 7,
    },

    shadowOpacity: 0.13,
    shadowRadius: 12,

    elevation: 9,
  },

  googleRow: {
    paddingHorizontal: 0,
    paddingVertical: 0,

    backgroundColor: "#FFFFFF",
  },

  googleResultRow: {
    minHeight: 58,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 13,
    paddingVertical: 9,

    backgroundColor: "#FFFFFF",
  },

  googleResultIcon: {
    width: 34,
    height: 34,

    borderRadius: 11,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#F0F0EE",

    marginRight: 10,
  },

  googleResultIconGlyph: {
    color: "#242424",
  },

  googleResultText: {
    flex: 1,
  },

  googleResultDescription: {
    fontSize: 11,
    lineHeight: 16,

    fontWeight: "600",

    color: "#252525",
  },

  googleDescription: {
    fontSize: 11,

    color: "#252525",
  },

  googleSeparator: {
    height: 1,

    marginLeft: 57,

    backgroundColor: "#EEEEEB",
  },

  gPoweredContainer: {
    display: "none",
    height: 0,
  },

  clearIconContainer: {
    position: "absolute",

    top: 17,
    right: 12,

    width: 25,
    height: 25,

    zIndex: 1000,

    alignItems: "center",
    justifyContent: "center",
  },

  clearIcon: {
    color: "#858585",
  },

  // ============================================================
  // 13. ADDRESS PAGE — LOCATION HINT
  // Used by: AddressPage
  // ============================================================

  locationHint: {
    flexDirection: "row",
    alignItems: "flex-start",

    marginTop: 9,

    paddingHorizontal: 2,
  },

  locationHintIcon: {
    marginRight: 6,
    marginTop: 1,

    color: "#777777",
  },

  locationHintText: {
    flex: 1,

    fontSize: 9,
    lineHeight: 14,

    fontWeight: "500",

    color: "#898989",
  },

  // ============================================================
  // 14. ADDRESS PAGE — SELECTED LOCATION
  // Used by: AddressPage
  // ============================================================

  selectedAddressCard: {
    marginTop: 15,

    padding: 15,

    borderRadius: 18,

    /*
     * Very subtle success background.
     * Green is intentionally NOT used as the main theme.
     */
    backgroundColor: "#F5F8F5",

    borderWidth: 1,
    borderColor: "#DCE5DC",
  },

  selectedAddressHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  selectedAddressIcon: {
    width: 34,
    height: 34,

    borderRadius: 12,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#202820",

    marginRight: 10,
  },

  selectedAddressCheck: {
    color: "#FFFFFF",
  },

  selectedAddressHeaderText: {
    flex: 1,
  },

  selectedAddressTitle: {
    fontSize: 12,
    fontWeight: "800",

    color: "#202820",
  },

  selectedAddressSubtitle: {
    marginTop: 2,

    fontSize: 9,
    fontWeight: "500",

    color: "#727A72",
  },

  selectedAddressDivider: {
    height: 1,

    marginVertical: 12,

    backgroundColor: "#DEE4DE",
  },

  selectedAddressBody: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  selectedAddressLocationIcon: {
    marginTop: 1,
    marginRight: 7,

    color: "#3C443C",
  },

  selectedAddressText: {
    flex: 1,

    fontSize: 10,
    lineHeight: 16,

    fontWeight: "600",

    color: "#343934",
  },

  // ============================================================
  // 15. ADDRESS PAGE — EMPTY LOCATION
  // Used by: AddressPage
  // ============================================================

  locationEmptyCard: {
    marginTop: 15,

    padding: 15,

    flexDirection: "row",
    alignItems: "center",

    borderRadius: 18,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#E2E2DF",
  },

  emptyLocationIcon: {
    width: 43,
    height: 43,

    borderRadius: 14,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#F0F0EE",

    marginRight: 11,
  },

  emptyLocationIconGlyph: {
    color: "#777777",
  },

  emptyLocationText: {
    flex: 1,
  },

  emptyLocationTitle: {
    fontSize: 11,
    fontWeight: "800",

    color: "#464646",
  },

  emptyLocationSubtitle: {
    marginTop: 3,

    fontSize: 9,
    lineHeight: 14,

    fontWeight: "500",

    color: "#898989",
  },

  // ============================================================
  // 16. ADDRESS PAGE — FOOTER
  // Used by: AddressPage
  // ============================================================

  addressNxtBtn: {
    marginTop: 10,
  },

  // ============================================================
  // 17. REVIEW PROFILE — COMPLETION CARD
  // Used by: ReviewUserCom
  // ============================================================

  completionCard: {
    marginTop: 20,

    padding: 16,

    flexDirection: "row",
    alignItems: "center",

    borderRadius: 20,

    backgroundColor: "#171717",

    borderWidth: 1,
    borderColor: "#292929",
  },

  completionIconContainer: {
    width: 45,
    height: 45,

    borderRadius: 15,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#FFFFFF",

    marginRight: 12,
  },

  completionIcon: {
    color: "#111111",
  },

  completionContent: {
    flex: 1,
  },

  completionTitle: {
    fontSize: 13,
    fontWeight: "800",

    color: "#FFFFFF",
  },

  completionText: {
    marginTop: 4,

    fontSize: 9,
    lineHeight: 14,

    fontWeight: "500",

    color: "#AFAFAF",
  },

  // ============================================================
  // 18. REVIEW PROFILE — PHOTO CARD
  // Used by: ReviewUserCom
  // ============================================================

  photoCard: {
    marginTop: 14,

    padding: 16,

    borderRadius: 20,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#E3E3E0",
  },

  photoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  photoCardTitle: {
    fontSize: 13,
    fontWeight: "800",

    color: "#191919",
  },

  photoCardSubtitle: {
    marginTop: 3,

    fontSize: 9,
    fontWeight: "500",

    color: "#898989",
  },

  removePhotoButton: {
    minHeight: 32,

    paddingHorizontal: 10,

    borderRadius: 10,

    flexDirection: "row",
    alignItems: "center",

    backgroundColor: "#FFF2F2",

    borderWidth: 1,
    borderColor: "#FFD9D9",
  },

  removePhotoIcon: {
    marginRight: 5,

    color: "#C90707",
  },

  removePhotoText: {
    fontSize: 9,
    fontWeight: "800",

    color: "#C90707",
  },

  photoCardBody: {
    alignItems: "center",

    paddingTop: 17,
  },

  reviewProfilePicContainer: {
    width: 112,
    height: 112,

    borderRadius: 56,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#E8E8E5",

    borderWidth: 4,
    borderColor: "#FFFFFF",

    shadowColor: "#000000",

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.12,
    shadowRadius: 10,

    elevation: 5,
  },

  reviewPlaceholder: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",
  },

  reviewPlaceholderIcon: {
    width: 59,
    height: 59,

    borderRadius: 30,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#DCDCD9",
  },

  reviewPlaceholderGlyph: {
    color: "#6E6E6E",
  },

  photoStatus: {
    marginTop: 10,

    flexDirection: "row",
    alignItems: "center",
  },

  statusDot: {
    width: 7,
    height: 7,

    borderRadius: 4,

    /*
     * Green remains only as a subtle success indicator.
     */
    backgroundColor: "#4B7655",

    marginRight: 6,
  },

  statusDotMuted: {
    width: 7,
    height: 7,

    borderRadius: 4,

    backgroundColor: "#A6A6A6",

    marginRight: 6,
  },

  photoStatusText: {
    fontSize: 9,
    fontWeight: "700",

    color: "#4B7655",
  },

  photoStatusTextMuted: {
    fontSize: 9,
    fontWeight: "700",

    color: "#898989",
  },

  // ============================================================
  // 19. REVIEW PROFILE — INFORMATION CARDS
  // Used by: ReviewUserCom
  // ============================================================

  infoCard: {
    marginTop: 14,

    padding: 16,

    borderRadius: 20,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#E3E3E0",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",

    marginBottom: 13,
  },

  cardHeaderIcon: {
    width: 38,
    height: 38,

    borderRadius: 12,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#F0F0EE",

    marginRight: 10,
  },

  cardHeaderIconGlyph: {
    color: "#222222",
  },

  cardTitle: {
    fontSize: 13,
    fontWeight: "800",

    color: "#191919",
  },

  cardSubtitle: {
    marginTop: 2,

    fontSize: 9,
    fontWeight: "500",

    color: "#898989",
  },

  infoList: {
    borderRadius: 14,

    overflow: "hidden",

    backgroundColor: "#F7F7F5",
  },

  infoRow: {
    minHeight: 65,

    paddingHorizontal: 12,
    paddingVertical: 10,

    flexDirection: "row",
    alignItems: "center",

    borderBottomWidth: 1,
    borderBottomColor: "#E4E4E1",
  },

  infoRowLast: {
    borderBottomWidth: 0,
  },

  infoIconContainer: {
    width: 34,
    height: 34,

    borderRadius: 11,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#FFFFFF",

    marginRight: 10,
  },

  infoIcon: {
    color: "#6B6B6B",
  },

  infoContent: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 8,

    fontWeight: "700",

    color: "#8A8A8A",

    textTransform: "uppercase",

    letterSpacing: 0.4,
  },

  infoValue: {
    marginTop: 3,

    fontSize: 11,
    lineHeight: 16,

    fontWeight: "700",

    /*
     * Explicit color keeps values readable in dark mode.
     */
    color: "#202020",
  },

  infoCheck: {
    marginLeft: 7,

    /*
     * Subtle confirmation green.
     * This is intentionally NOT the primary brand color.
     */
    color: "#4B7655",
  },

  // ============================================================
  // 20. REVIEW PROFILE — LOCATION CONFIRMATION
  // Used by: ReviewUserCom
  // ============================================================

  locationConfirmation: {
    marginTop: 14,

    padding: 14,

    flexDirection: "row",
    alignItems: "center",

    borderRadius: 17,

    backgroundColor: "#F4F5F3",

    borderWidth: 1,
    borderColor: "#DFE2DE",
  },

  locationConfirmationIcon: {
    width: 37,
    height: 37,

    borderRadius: 12,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#E8EAE7",

    marginRight: 10,
  },

  locationConfirmationGlyph: {
    color: "#343934",
  },

  locationConfirmationContent: {
    flex: 1,
  },

  locationConfirmationTitle: {
    fontSize: 10,
    fontWeight: "800",

    color: "#2C302C",
  },

  locationConfirmationText: {
    marginTop: 3,

    fontSize: 8,
    lineHeight: 13,

    fontWeight: "500",

    color: "#777B77",
  },

  locationConfirmationCheck: {
    marginLeft: 8,

    color: "#4B7655",
  },

  // ============================================================
  // 21. REVIEW PROFILE — FINAL MESSAGE
  // Used by: ReviewUserCom
  // ============================================================

  finalMessage: {
    marginTop: 14,

    paddingHorizontal: 13,
    paddingVertical: 12,

    flexDirection: "row",
    alignItems: "center",

    borderRadius: 14,

    backgroundColor: "#ECECEA",
  },

  finalMessageIcon: {
    marginRight: 8,

    color: "#555555",
  },

  finalMessageText: {
    flex: 1,

    fontSize: 8,
    lineHeight: 13,

    fontWeight: "500",

    color: "#707070",
  },

  // ============================================================
  // 22. REVIEW PROFILE — SAVE BUTTON
  // Used by: ReviewUserCom
  // ============================================================

  saveButton: {
    minHeight: 64,

    paddingLeft: 19,
    paddingRight: 8,

    borderRadius: 19,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    backgroundColor: "#111111",

    shadowColor: "#000000",

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.2,
    shadowRadius: 9,

    elevation: 5,
  },

  saveButtonDisabled: {
    backgroundColor: "#555555",

    shadowOpacity: 0.05,

    elevation: 2,
  },

  saveButtonTextContainer: {
    flex: 1,
  },

  saveButtonLabel: {
    fontSize: 14,
    fontWeight: "800",

    color: "#FFFFFF",
  },

  saveButtonSubLabel: {
    marginTop: 3,

    fontSize: 9,
    fontWeight: "500",

    color: "#AFAFAF",
  },

  saveButtonIconContainer: {
    width: 47,
    height: 47,

    borderRadius: 15,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#2B2B2B",
  },

  saveButtonIcon: {
    color: "#FFFFFF",
  },

  savingState: {
    flex: 1,

    flexDirection: "row",
    alignItems: "center",
  },

  savingTextContainer: {
    marginLeft: 12,
  },

  // ============================================================
  // 23. LEGACY / COMPATIBILITY STYLES
  // These can remain temporarily without affecting the
  // redesigned screens.
  // ============================================================

  bckBtnCon: {
    position: "absolute",

    top: 10,
    left: 10,

    zIndex: 20,
  },

  bckBtnIcon: {
    fontSize: 25,

    color: "#111111",
  },

  signoutBtn: {
    position: "absolute",

    top: 10,
    right: 15,

    zIndex: 20,
  },

  signoutTxt: {
    fontSize: 12,
    fontWeight: "700",

    color: "#C90707",
  },

  addressNxtBtnIcon: {
    fontSize: 50,

    color: "#FFFFFF",
  },

  nxtBtn: {
    backgroundColor: "#111111",

    marginTop: 10,

    padding: 2,

    marginHorizontal: 80,

    marginBottom: 10,

    alignItems: "center",

    borderRadius: 30,
  },

  nxtBtnIcon: {
    fontSize: 50,

    color: "#FFFFFF",
  },
});

export default styles;
