import { StyleSheet } from "react-native";

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    // paddingHorizontal: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 25,
    color: "#0F172A",
  },

  card: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
    color: "#334155",
  },

  value: {
    fontSize: 14,
    color: "#1E293B",
    marginBottom: 4,
  },

  priceCard: {
    backgroundColor: "#0F172A",
    padding: 25,
    borderRadius: 20,
    marginBottom: 20,
    alignItems: "center",
  },

  priceLabel: {
    color: "#CBD5E1",
    fontSize: 14,
  },

  priceRange: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 6,
  },

  subLabel: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 6,
  },

  offerControl: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },

  adjustBtn: {
    backgroundColor: "#1E293B",
    width: 45,
    height: 45,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  adjustText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },

  offerInput: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    fontSize: 18,
    fontWeight: "600",
    minWidth: 120,
    textAlign: "center",
  },

  helperText: {
    color: "#CBD5E1",
    fontSize: 12,
    marginTop: 10,
    textAlign: "center",
  },

  // price: {
  //   fontSize: 28,
  //   fontWeight: "700",
  //   color: "#FFFFFF",
  //   marginTop: 5,
  // },

  uploadBtn: {
    backgroundColor: "#111827",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },

  uploadText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 10,
  },

  videoPreview: {
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
  },

  videoThumbnail: {
    width: "100%",
    height: 180,
    borderRadius: 12,
  },

  playOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },

  validationText: {
    color: "#EF4444",
    marginTop: 8,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "500",
  },
});
