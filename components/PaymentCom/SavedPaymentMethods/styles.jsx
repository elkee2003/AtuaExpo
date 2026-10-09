import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  //-----------------------------------------
  // Main
  //-----------------------------------------

  container: {
    backgroundColor: "#F8F9FB",
    marginBottom: 18,
  },

  //-----------------------------------------
  // Section Header
  //-----------------------------------------

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  sectionHeaderContent: {
    flex: 1,
    paddingRight: 12,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },

  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: "#6B7280",
  },

  //-----------------------------------------
  // Loading
  //-----------------------------------------

  loadingContainer: {
    minHeight: 90,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  loadingText: {
    marginTop: 9,
    fontSize: 12,
    color: "#6B7280",
  },

  //-----------------------------------------
  // Payment Methods List
  //-----------------------------------------

  paymentMethodsList: {
    marginBottom: 12,
  },

  //-----------------------------------------
  // Payment Method Card
  //-----------------------------------------

  paymentMethodCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
    minHeight: 88,
    overflow: "hidden",
  },

  paymentMethodCardSelected: {
    borderColor: "#111827",
    borderWidth: 1.5,
  },

  paymentMethodCardDisabled: {
    opacity: 0.55,
  },

  //-----------------------------------------
  // Payment Method Selection Area
  //-----------------------------------------

  paymentMethodSelectArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 14,
  },

  //-----------------------------------------
  // Radio
  //-----------------------------------------

  radioOuter: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  radioOuterSelected: {
    borderColor: "#111827",
  },

  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#111827",
  },

  //-----------------------------------------
  // Card Information
  //-----------------------------------------

  cardInformation: {
    flex: 1,
    minWidth: 0,
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },

  cardBrand: {
    flexShrink: 1,
    fontSize: 13.5,
    fontWeight: "700",
    color: "#111827",
  },

  cardNumber: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    letterSpacing: 0.4,
    marginBottom: 4,
  },

  cardExpiry: {
    fontSize: 11,
    color: "#6B7280",
  },

  cardBank: {
    fontSize: 10.5,
    color: "#9CA3AF",
    marginTop: 2,
  },

  //-----------------------------------------
  // Default Badge
  //-----------------------------------------

  defaultBadge: {
    marginLeft: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
  },

  defaultBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#374151",
  },

  //-----------------------------------------
  // Delete
  //-----------------------------------------

  deleteButton: {
    width: 48,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "#E5E7EB",
  },

  //-----------------------------------------
  // Pay With Saved Card
  //-----------------------------------------

  payButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#111827",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 2,
  },

  payButtonDisabled: {
    opacity: 0.55,
  },

  payButtonText: {
    flex: 1,
    textAlign: "center",
    fontSize: 14.5,
    fontWeight: "700",
    color: "#FFFFFF",
    marginHorizontal: 10,
  },

  //-----------------------------------------
  // Use New Card
  //-----------------------------------------

  newCardButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 10,
  },

  newCardButtonDisabled: {
    opacity: 0.55,
  },

  newCardButtonText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#111827",
    marginLeft: 7,
  },

  //-----------------------------------------
  // Empty State
  //-----------------------------------------

  emptyContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 24,
    marginBottom: 12,
  },

  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 5,
  },

  emptyText: {
    fontSize: 11.5,
    lineHeight: 17,
    color: "#6B7280",
    textAlign: "center",
    maxWidth: 290,
  },

  //-----------------------------------------
  // Error
  //-----------------------------------------

  errorContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },

  errorContent: {
    flex: 1,
    marginLeft: 10,
  },

  errorTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#991B1B",
    marginBottom: 4,
  },

  errorText: {
    fontSize: 11.5,
    lineHeight: 17,
    color: "#6B7280",
  },

  retryButton: {
    alignSelf: "flex-start",
    minWidth: 90,
    height: 36,
    borderRadius: 9,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 10,
  },

  retryButtonText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  //-----------------------------------------
  // Security Note
  //-----------------------------------------

  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    marginTop: 12,
  },

  securityNoteText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 15,
    color: "#6B7280",
    marginLeft: 6,
    textAlign: "center",
  },
});

export default styles;
