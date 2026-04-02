import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  cardActive: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  date: {
    fontSize: 13,
    color: "#6B7280",
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  statusDelivered: {
    backgroundColor: "#16A34A",
  },

  statusActive: {
    backgroundColor: "#2563EB",
  },

  statusPending: {
    backgroundColor: "#F59E0B",
  },

  statusCancelled: {
    backgroundColor: "#DC2626",
  },

  recipient: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 14,
    color: "#111827",
  },

  details: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 6,
    lineHeight: 20,
  },

  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 14,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  price: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  transport: {
    fontSize: 13,
    color: "#6B7280",
    textTransform: "capitalize",
  },

  trackButton: {
    marginTop: 16,
    backgroundColor: "#2563EB",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },

  trackText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  deleteButton: {
    marginTop: 16,
    backgroundColor: "#FEF2F2",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },

  deleteText: {
    color: "#DC2626",
    fontWeight: "600",
  },

  cancelButton: {
    marginTop: 16,
    backgroundColor: "#FFF7ED",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },

  cancelText: {
    color: "#EA580C",
    fontWeight: "600",
  },
});

export default styles;
