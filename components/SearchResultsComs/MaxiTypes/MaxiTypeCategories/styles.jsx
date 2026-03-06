import { StyleSheet } from "react-native";

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
  },

  header: {
    fontSize: 22,
    fontWeight: "700",
    marginVertical: 16,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  image: {
    width: "100%",
    height: 180,
  },

  content: {
    padding: 16,
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },

  capacity: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 6,
  },

  description: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 14,
  },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  galleryBtn: {
    backgroundColor: "#f3f4f6",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },

  galleryText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },

  selectBtn: {
    backgroundColor: "#111",
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 8,
  },

  selectText: {
    color: "#fff",
    fontWeight: "600",
  },
});
