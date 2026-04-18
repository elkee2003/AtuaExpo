import { Dimensions, StyleSheet } from "react-native";

const { width } = Dimensions.get("window");

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  map: {
    flex: 1,
  },

  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },

  /* 🔵 Searching Pulse Marker */

  /* 🔵 Searching Pulse Marker */

  pulseContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },

  pulseRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(37, 202, 16, 0.4)",
  },

  pulseCore: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#05dd34",
  },

  /* 🚗 Courier Avatar Marker */

  courierAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: "#fff",
  },

  uploadContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 8,

    backgroundColor: "#E8F5E9", // light green background
    borderRadius: 12,
  },

  uploadText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: "500",
    color: "#2E7D32", // darker green
  },
});
