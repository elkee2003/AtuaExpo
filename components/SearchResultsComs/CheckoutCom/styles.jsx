import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },

  paymentDescription: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
    marginTop: -2,
    marginBottom: 12,
  },

  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
    gap: 12,
  },

  paymentOptionSelected: {
    borderColor: "#111827",
    backgroundColor: "#F3F4F6",
  },

  paymentOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  paymentOptionContent: {
    flex: 1,
  },

  paymentOptionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },

  paymentOptionDescription: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 17,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  label: {
    fontSize: 14,
    color: "#6B7280",
  },

  value: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    maxWidth: "60%",
    textAlign: "right",
  },

  detailsText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  locationText: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
  },

  verticalLine: {
    height: 24,
    width: 1,
    backgroundColor: "#E5E7EB",
    marginLeft: 6,
    marginVertical: 8,
  },

  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
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

  // Payment Responsibility
  paymentResponsibilityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },

  paymentResponsibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },

  paymentResponsibilityIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  paymentResponsibilityContent: {
    flex: 1,
  },

  paymentResponsibilityLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },

  paymentResponsibilityValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },

  paymentResponsibilityDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 19,
  },

  bottomContainer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: 20,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
  },

  orderButton: {
    height: 56,
    marginBottom: 60,
    backgroundColor: "#111827",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },

  orderText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default styles;
