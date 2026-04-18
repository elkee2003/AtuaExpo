import { StyleSheet } from "react-native";

export default StyleSheet.create({
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },

  statusTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: 0.2,
  },

  statusSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 6,
    lineHeight: 18,
  },

  statusContainer: {
    marginBottom: 16,
    paddingVertical: 6,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginRight: 8,

    shadowColor: "#10B981",
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },

  orderText: {
    textAlign: "center",
    color: "#334155",
    fontWeight: "600",

    backgroundColor: "#F8FAFC",
    paddingVertical: 10,
    borderRadius: 999,
    marginBottom: 20,

    borderWidth: 1,
    borderColor: "#E2E8F0",

    overflow: "hidden",
  },

  cancelBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#FEF2F2",

    alignItems: "center",

    borderWidth: 1,
    borderColor: "#FECACA",
  },

  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#D64545",
  },

  driverCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    marginTop: 16,

    borderWidth: 1,
    borderColor: "#F1F5F9",

    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },

    elevation: 4,
  },

  driverImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 14,
    backgroundColor: "#eee",
  },

  driverInfo: {
    flex: 1,
  },

  driverName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111",
  },

  driverSub: {
    fontSize: 13,
    color: "#777",
    marginTop: 3,
  },

  driverMeta: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },

  phoneText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#2563EB",
  },

  copyHint: {
    fontSize: 11,
    color: "#999",
  },

  priceBadge: {
    marginTop: 10,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },

  priceText: {
    color: "#2E7D32",
    fontWeight: "700",
    fontSize: 14,
  },
});
