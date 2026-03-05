import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    padding: 20,
  },

  header: {
    marginBottom: 20,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
  },

  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },

  countdown: {
    fontSize: 14,
    color: "#ef4444",
    marginBottom: 20,
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

  cancelText: {
    textAlign: "center",
    color: "#ef4444",
    marginTop: 20,
    fontWeight: "600",
  },
});
