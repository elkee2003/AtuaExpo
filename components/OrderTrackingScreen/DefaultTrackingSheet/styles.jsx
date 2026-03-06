import { StyleSheet } from "react-native";

export default StyleSheet.create({
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },

  /* 🏷 Status */

  statusTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
    marginBottom: 6,
  },

  statusSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },

  orderText: {
    textAlign: "center",
    color: "#252424",
    marginTop: 20,
    fontWeight: "600",
    backgroundColor: "rgb(240, 240, 240)",
    padding: 10,
    marginHorizontal: 80,
    borderRadius: 20,
  },

  /* ❌ Cancel Button */

  cancelBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F2F2F2",
    alignItems: "center",
  },

  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#D64545",
  },

  /* 🚗 Driver Card */

  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
    marginTop: 10,
  },

  driverImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 14,
  },

  driverName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },

  driverSub: {
    fontSize: 13,
    color: "#777",
    marginTop: 2,
  },
});
