import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  //-----------------------------------------
  // Main
  //-----------------------------------------

  safeArea: {
    flex: 1,
    backgroundColor: "#F8F9FB",
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 30,
  },

  //-----------------------------------------
  // Header
  //-----------------------------------------

  header: {
    height: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },

  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },

  //-----------------------------------------
  // Amount
  //-----------------------------------------

  amountCard: {
    backgroundColor: "#111827",
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 26,
    marginBottom: 18,
  },

  amountLabel: {
    fontSize: 13,
    color: "#D1D5DB",
    marginBottom: 8,
  },

  amount: {
    fontSize: 34,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },

  orderReferenceContainer: {
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#374151",
    flexDirection: "row",
    alignItems: "center",
  },

  orderReferenceLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginRight: 8,
  },

  orderReference: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#E5E7EB",
  },

  //-----------------------------------------
  // Generic Card
  //-----------------------------------------

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 18,
  },

  //-----------------------------------------
  // Summary
  //-----------------------------------------

  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  summaryLabel: {
    fontSize: 14,
    color: "#6B7280",
  },

  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
    marginTop: 4,
    marginBottom: 16,
  },

  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  totalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },

  //-----------------------------------------
  // Security
  //-----------------------------------------

  securityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },

  securityIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  securityContent: {
    flex: 1,
  },

  securityTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#166534",
    marginBottom: 4,
  },

  securityText: {
    fontSize: 12.5,
    lineHeight: 19,
    color: "#4B5563",
  },

  //-----------------------------------------
  // Powered By
  //-----------------------------------------

  poweredBy: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  poweredByText: {
    fontSize: 11.5,
    color: "#6B7280",
    marginLeft: 5,
  },

  //-----------------------------------------
  // Bottom
  //-----------------------------------------

  bottomContainer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },

  payButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: "#111827",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  payButtonDisabled: {
    opacity: 0.65,
  },

  payButtonText: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  bottomDisclaimer: {
    fontSize: 10.5,
    lineHeight: 15,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 9,
    paddingHorizontal: 20,
  },

  //-----------------------------------------
  // Loading
  //-----------------------------------------

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: "#6B7280",
  },

  //-----------------------------------------
  // Error
  //-----------------------------------------

  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  errorTitle: {
    marginTop: 15,
    fontSize: 19,
    fontWeight: "700",
    color: "#111827",
  },

  errorText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    color: "#6B7280",
  },

  errorButton: {
    marginTop: 22,
    minWidth: 140,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  errorButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

export default styles;
