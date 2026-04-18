import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    padding: 20,
  },

  header: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: 0.2,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",

    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,

    marginBottom: 10,
  },

  statusPillWaiting: {
    backgroundColor: "#FFF7ED",
  },

  statusPillActive: {
    backgroundColor: "#ECFDF5",
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },

  dotWaiting: {
    backgroundColor: "#F59E0B",
  },

  dotActive: {
    backgroundColor: "#10B981",
  },

  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    letterSpacing: 0.2,
  },

  card: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    marginBottom: 12,
    alignItems: "center",
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },

  name: {
    fontSize: 16,
    fontWeight: "600",
  },

  vehicle: {
    fontSize: 12,
    color: "#6b7280",
  },

  price: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },

  actions: {
    justifyContent: "space-between",
  },

  acceptBtn: {
    backgroundColor: "#111",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 6,
  },

  acceptText: {
    color: "#fff",
    fontWeight: "600",
  },

  counterBtn: {
    borderWidth: 1,
    borderColor: "#111",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },

  counterText: {
    fontWeight: "600",
  },

  /* ================== COUNTER OFFER INPUT ================== */

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",

    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,

    backgroundColor: "#ffffff",

    borderRadius: 18,

    borderWidth: 1,
    borderColor: "#f1f5f9",

    // ✨ iOS shadow (softer + lifted)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 }, // 👈 upward shadow
    shadowOpacity: 0.06,
    shadowRadius: 10,

    // ✨ Android shadow
    elevation: 8,
  },

  input: {
    flex: 1,

    backgroundColor: "#f3f4f6",

    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,

    fontSize: 16,
    fontWeight: "500",
    color: "#111",

    borderWidth: 1,
    borderColor: "#e5e7eb",

    marginRight: 10,
  },

  sendBtn: {
    backgroundColor: "#111",

    paddingVertical: 12,
    paddingHorizontal: 18,

    borderRadius: 12,

    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },

  sendText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    letterSpacing: 0.3,
  },

  sendBtnDisabled: {
    backgroundColor: "#9ca3af",
  },

  waitingText: {
    textAlign: "center",
    marginTop: 10,
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },

  orderText: {
    textAlign: "center",
    marginTop: 16,
    fontSize: 16,
    color: "#2563EB",
    fontWeight: "500",
    textDecorationLine: "underline",
  },

  cancelText: {
    textAlign: "center",
    color: "#ef4444",
    marginTop: 20,
    marginBottom: 35,
    fontWeight: "600",
  },

  /* STYLES FOR RETRY BANNER */

  retryBanner: {
    backgroundColor: "#FFF3CD",
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 10,
  },

  retryText: {
    marginBottom: 8,
  },

  retryButton: {
    backgroundColor: "#FF9900",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
