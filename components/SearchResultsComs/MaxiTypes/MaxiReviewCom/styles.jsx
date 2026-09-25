import { StyleSheet } from "react-native";

export default StyleSheet.create({
  /* =========================================================
     SCREEN
  ========================================================= */

  screen: {
    flex: 1,
    backgroundColor: "#F4F6F8",
  },

  scrollContent: {
    paddingTop: 18,
    paddingBottom: 40,
  },

  bottomSpacer: {
    height: 20,
  },

  /* =========================================================
     PAGE HEADER
  ========================================================= */

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingHorizontal: 2,
  },

  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#FFF1E8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#FFE1CC",
  },

  headerText: {
    flex: 1,
  },

  eyebrow: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: "#F97316",
    marginBottom: 4,
  },

  title: {
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.7,
  },

  subtitle: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "400",
    color: "#7A8492",
    maxWidth: 310,
  },

  /* =========================================================
     GENERAL CARD
  ========================================================= */

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 17,
    marginBottom: 14,

    borderWidth: 1,
    borderColor: "#E8ECF0",

    shadowColor: "#111827",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.045,
    shadowRadius: 14,
    elevation: 2,
  },

  /* =========================================================
     CARD HEADER
  ========================================================= */

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#FFF4EC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#FFE5D3",
  },

  headerFlex: {
    flex: 1,
  },

  sectionTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    color: "#17202B",
    letterSpacing: -0.15,
  },

  sectionSubtitle: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "400",
    color: "#8A94A3",
  },

  /* =========================================================
     FIELD TYPOGRAPHY
     ========================================================= */

  fieldLabel: {
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "800",
    letterSpacing: 1.05,
    color: "#98A2B0",
    textTransform: "uppercase",
    marginBottom: 4,
  },

  fieldValue: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: "#202936",
  },

  fieldMeta: {
    marginTop: 3,
    fontSize: 9,
    lineHeight: 14,
    fontWeight: "500",
    color: "#8993A1",
  },

  infoValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#1C2530",
  },

  moneyValue: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    color: "#E85F0E",
  },

  /* =========================================================
     TRIP / ROUTE
  ========================================================= */

  routeContainer: {
    paddingVertical: 2,
    marginBottom: 17,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  locationIndicator: {
    width: 24,
    alignItems: "center",
    paddingTop: 4,
  },

  originDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#F97316",
    borderWidth: 2,
    borderColor: "#FFE1CD",
  },

  destinationDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#17202B",
    borderWidth: 2,
    borderColor: "#DDE2E7",
  },

  routeLine: {
    width: 1,
    height: 27,
    backgroundColor: "#D8DEE5",
    marginLeft: 11.5,
    marginVertical: 2,
  },

  locationContent: {
    flex: 1,
    paddingLeft: 7,
    paddingBottom: 2,
  },

  /* =========================================================
     INFORMATION GRID
  ========================================================= */

  infoGrid: {
    flexDirection: "row",
    backgroundColor: "#F8FAFB",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#EDF0F3",
    overflow: "hidden",
  },

  infoItem: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },

  infoItemDivider: {
    width: 1,
    backgroundColor: "#E6EAEF",
  },

  /* =========================================================
     DETAIL ROWS
  ========================================================= */

  detailRows: {
    width: "100%",
  },

  detailRow: {
    minHeight: 39,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  rowDivider: {
    height: 1,
    backgroundColor: "#F0F2F4",
  },

  /* =========================================================
     CARGO DESCRIPTION
  ========================================================= */

  descriptionBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFB",
    borderWidth: 1,
    borderColor: "#EDF0F3",
  },

  descriptionText: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "500",
    color: "#424C59",
  },

  /* =========================================================
     LOADING / HANDLING
  ========================================================= */

  handlingBlock: {
    padding: 13,
    backgroundColor: "#FAFBFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EDF0F2",
    marginBottom: 10,
  },

  handlingBlockLast: {
    marginBottom: 0,
  },

  handlingHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
  },

  handlingIcon: {
    width: 27,
    height: 27,
    borderRadius: 9,
    backgroundColor: "#FFF1E8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  handlingTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#28323E",
  },

  /* =========================================================
     RECIPIENT
  ========================================================= */

  recipientCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    backgroundColor: "#F8FAFB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EDF0F3",
  },

  avatar: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#17202B",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  avatarText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  recipientInfo: {
    flex: 1,
  },

  recipientName: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#202936",
    marginBottom: 4,
  },

  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },

  phoneText: {
    marginLeft: 5,
    fontSize: 9,
    lineHeight: 14,
    fontWeight: "500",
    color: "#697586",
  },

  /* =========================================================
     PRICE CARD
  ========================================================= */

  priceCard: {
    backgroundColor: "#121A24",
    borderRadius: 21,
    padding: 19,
    marginBottom: 14,

    borderWidth: 1,
    borderColor: "#25313E",

    shadowColor: "#0B1016",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 5,
  },

  priceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  priceEyebrow: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: "#F97316",
    marginBottom: 4,
  },

  priceTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.25,
  },

  priceIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#252F3B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#303C49",
  },

  rangeContainer: {
    backgroundColor: "#19232E",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "#263340",
  },

  rangeLabel: {
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 1.05,
    color: "#8491A0",
    marginBottom: 5,
  },

  priceRange: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },

  offerDescription: {
    fontSize: 9,
    lineHeight: 14,
    fontWeight: "400",
    color: "#8E9AA8",
    marginTop: 12,
  },

  /* =========================================================
     OFFER CONTROL
  ========================================================= */

  offerControl: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },

  adjustBtn: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#26313D",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#34404D",
  },

  offerInputContainer: {
    flex: 1,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 10,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  offerInputContainerError: {
    borderColor: "#F87171",
  },

  currencyPrefix: {
    fontSize: 17,
    fontWeight: "800",
    color: "#F97316",
    marginRight: 2,
  },

  offerInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    color: "#17202B",
    textAlign: "center",
  },

  validationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  validationText: {
    marginLeft: 5,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "600",
    color: "#F87171",
  },

  helperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  helperText: {
    marginLeft: 5,
    fontSize: 8,
    lineHeight: 12,
    fontWeight: "500",
    color: "#7F8B99",
  },

  /* =========================================================
     MEDIA UPLOAD
  ========================================================= */

  uploadBtn: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#17202B",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#25313D",
  },

  uploadIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  uploadContent: {
    flex: 1,
  },

  uploadText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  uploadSubtext: {
    fontSize: 8,
    lineHeight: 12,
    fontWeight: "400",
    color: "#8D99A7",
    marginTop: 2,
  },

  mediaRow: {
    paddingTop: 12,
    paddingBottom: 2,
  },

  photoWrapper: {
    width: 78,
    height: 78,
    borderRadius: 13,
    overflow: "hidden",
    marginRight: 9,
    backgroundColor: "#E9EDF1",
    borderWidth: 1,
    borderColor: "#E1E6EA",
  },

  previewImage: {
    width: "100%",
    height: "100%",
  },

  photoIndex: {
    position: "absolute",
    bottom: 5,
    left: 5,
    minWidth: 19,
    height: 19,
    borderRadius: 7,
    backgroundColor: "rgba(17,24,39,0.78)",
    alignItems: "center",
    justifyContent: "center",
  },

  photoIndexText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "800",
  },

  /* =========================================================
     VIDEO
  ========================================================= */

  videoPreview: {
    height: 190,
    marginTop: 12,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#E2E6EA",
  },

  videoThumbnail: {
    width: "100%",
    height: "100%",
  },

  playOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,15,20,0.25)",
  },

  playButton: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "rgba(249,115,22,0.95)",
    alignItems: "center",
    justifyContent: "center",

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  videoPreviewLabel: {
    marginTop: 8,
    fontSize: 8,
    fontWeight: "700",
    color: "#FFFFFF",
    backgroundColor: "rgba(10,15,20,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },

  /* =========================================================
     BADGES
  ========================================================= */

  countBadge: {
    minWidth: 25,
    height: 25,
    paddingHorizontal: 7,
    borderRadius: 9,
    backgroundColor: "#FFF1E8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFE0CC",
  },

  countBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#E85F0E",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    height: 25,
    borderRadius: 9,
    backgroundColor: "#ECFDF3",
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },

  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#22C55E",
    marginRight: 5,
  },

  statusText: {
    fontSize: 7,
    fontWeight: "800",
    color: "#15803D",
    letterSpacing: 0.3,
  },
});
