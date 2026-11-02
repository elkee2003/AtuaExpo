import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  /* Main layout */
  container: {
    flex: 1,
    backgroundColor: "#F8F9FB",
  },

  scrollView: {
    flex: 1,
  },

  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 30,
  },

  /* Header */
  header: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },

  headerBackButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "700",
  },

  headerSubtitle: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 11,
    lineHeight: 16,
  },

  /* Loading and error states */
  stateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F8F9FB",
  },

  stateIcon: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderRadius: 18,
    backgroundColor: "#FEF2F2",
  },

  stateTitle: {
    marginBottom: 6,
    color: "#111827",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },

  stateText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 13,
  },

  errorText: {
    marginVertical: 12,
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },

  /* Error banner */
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    padding: 13,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },

  errorBannerText: {
    flex: 1,
    color: "#B91C1C",
    fontSize: 12,
    lineHeight: 18,
  },

  /* Amount card */
  amountCard: {
    paddingHorizontal: 22,
    paddingVertical: 23,
    marginBottom: 18,
    borderRadius: 20,
    backgroundColor: "#111827",
  },

  amountCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  amountLabel: {
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "500",
  },

  amount: {
    marginTop: 8,
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  amountIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#263244",
  },

  amountCardDivider: {
    height: 1,
    marginTop: 22,
    marginBottom: 15,
    backgroundColor: "#374151",
  },

  amountFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },

  receiverBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#DCFCE7",
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#15803D",
  },

  receiverBadgeText: {
    color: "#166534",
    fontSize: 10,
    fontWeight: "700",
  },

  amountFooterText: {
    color: "#9CA3AF",
    fontSize: 11,
  },

  referenceSection: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },

  referenceLabel: {
    marginBottom: 7,
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.8,
  },

  referenceValue: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 19,
  },

  /* General cards */
  card: {
    padding: 18,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.025,
    shadowRadius: 5,
    elevation: 1,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 17,
  },

  sectionIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "#F3F4F6",
  },

  cardTitle: {
    flex: 1,
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },

  /* Order detail rows */
  detailRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },

  detailLabel: {
    marginBottom: 5,
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "500",
  },

  detailValue: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 19,
  },

  /* Payment instructions */
  description: {
    marginTop: -3,
    marginBottom: 17,
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 20,
  },

  /* Primary button */
  primaryButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#111827",
    backgroundColor: "#111827",
  },

  primaryButtonText: {
    flexShrink: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  disabledButton: {
    opacity: 0.65,
  },

  /* Secondary buttons */
  secondaryButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
  },

  secondaryButtonText: {
    flexShrink: 1,
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },

  /* Generated payment link */
  linkSection: {
    marginTop: 2,
  },

  linkReadyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginBottom: 17,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    backgroundColor: "#F0FDF4",
  },

  linkReadyText: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "700",
  },

  linkLabel: {
    marginBottom: 8,
    color: "#374151",
    fontSize: 11,
    fontWeight: "700",
  },

  linkText: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 11,
    backgroundColor: "#F8F9FB",
    color: "#374151",
    fontSize: 11,
    lineHeight: 19,
    flexShrink: 1,
  },

  /* Secure payment notice */
  securityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    backgroundColor: "#F0FDF4",
  },

  securityIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#DCFCE7",
  },

  securityContent: {
    flex: 1,
  },

  securityTitle: {
    marginBottom: 5,
    color: "#166534",
    fontSize: 13,
    fontWeight: "700",
  },

  securityText: {
    color: "#4B5563",
    fontSize: 11,
    lineHeight: 18,
  },

  /* Paystack footer */
  poweredBy: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    marginBottom: 8,
  },

  poweredByText: {
    color: "#6B7280",
    fontSize: 11,
  },
});

export default styles;
