import { StyleSheet } from "react-native";

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 16,
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    marginVertical: 20,
    color: "#111827",
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    marginBottom: 20,
    overflow: "hidden",
    elevation: 4,
  },

  image: {
    width: "100%",
    height: 200,
  },

  badgeContainer: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
  },

  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
    marginRight: 6,
  },

  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  content: {
    padding: 16,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  model: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  verified: {
    fontSize: 12,
    fontWeight: "600",
    color: "#16a34a",
  },

  vehicleClass: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
  },

  plate: {
    fontSize: 13,
    marginTop: 6,
    color: "#374151",
  },

  description: {
    marginTop: 10,
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    alignItems: "center",
  },

  driver: {
    fontSize: 13,
    color: "#6b7280",
  },

  more: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
});
