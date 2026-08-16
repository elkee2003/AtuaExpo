import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  // =========================================================
  // MODAL
  // =========================================================

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },

  modalContainer: {
    width: "100%",
    maxHeight: "94%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },

  // =========================================================
  // HEADER
  // =========================================================

  header: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 20,
  },

  successIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  headerTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },

  headerSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7280",
    textAlign: "center",
    maxWidth: 300,
  },

  // =========================================================
  // SCROLL CONTENT
  // =========================================================

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  // =========================================================
  // DELIVERY REFERENCE
  // =========================================================

  orderReferenceContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 18,
  },

  orderReferenceLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },

  orderReferenceValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 0.5,
  },

  // =========================================================
  // GENERAL SECTION
  // =========================================================

  section: {
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },

  // =========================================================
  // DELIVERY ROUTE
  // =========================================================

  routeContainer: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 15,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  locationIconContainer: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  locationContent: {
    flex: 1,
    paddingTop: 1,
  },

  locationLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  locationText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#111827",
    fontWeight: "500",
  },

  routeConnector: {
    width: 1,
    height: 22,
    backgroundColor: "#D1D5DB",
    marginLeft: 11.5,
    marginVertical: 2,
  },

  // =========================================================
  // COURIER
  // =========================================================

  courierCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 14,
  },

  courierImage: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#E5E7EB",
  },

  courierInfo: {
    flex: 1,
    marginLeft: 14,
    minWidth: 0,
  },

  courierName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },

  courierTransport: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 3,
  },

  courierVehicle: {
    fontSize: 12,
    color: "#6B7280",
  },

  // =========================================================
  // RATING
  // =========================================================

  ratingSection: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 20,
  },

  ratingTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },

  ratingSubtitle: {
    marginTop: 5,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },

  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 17,
  },

  starButton: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },

  ratingValue: {
    minHeight: 20,
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#F59E0B",
    textAlign: "center",
  },

  // =========================================================
  // COMMENT
  // =========================================================

  commentSection: {
    marginTop: 2,
  },

  commentLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },

  optionalText: {
    fontWeight: "400",
    color: "#9CA3AF",
  },

  commentInput: {
    minHeight: 105,
    maxHeight: 150,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    lineHeight: 19,
    color: "#111827",
  },

  characterCount: {
    marginTop: 5,
    alignSelf: "flex-end",
    fontSize: 10,
    color: "#9CA3AF",
  },

  // =========================================================
  // ERROR
  // =========================================================

  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
    gap: 8,
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: "#B91C1C",
  },

  // =========================================================
  // BOTTOM SPACING
  // =========================================================

  bottomSpacing: {
    height: 8,
  },

  // =========================================================
  // FOOTER
  // =========================================================

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },

  // =========================================================
  // SUBMIT BUTTON
  // =========================================================

  submitButton: {
    height: 54,
    borderRadius: 15,
    backgroundColor: "#111827",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },

  submitButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },

  submitButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  submitButtonTextDisabled: {
    color: "#9CA3AF",
  },
});

export default styles;
