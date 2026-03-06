import { StyleSheet } from "react-native";

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },

  card: {
    backgroundColor: "#ffffff",
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  model: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },

  verified: {
    fontSize: 13,
    fontWeight: "600",
    color: "#16a34a",
  },

  vehicleClass: {
    marginTop: 6,
    fontSize: 14,
    color: "#6b7280",
  },

  plate: {
    marginTop: 8,
    fontSize: 14,
    color: "#374151",
  },

  availabilityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },

  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },

  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 20,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  description: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "#4b5563",
  },

  driverName: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },

  bottomBar: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
  },

  requestBtn: {
    backgroundColor: "#111827",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },

  disabledBtn: {
    backgroundColor: "#9ca3af",
  },

  requestText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
