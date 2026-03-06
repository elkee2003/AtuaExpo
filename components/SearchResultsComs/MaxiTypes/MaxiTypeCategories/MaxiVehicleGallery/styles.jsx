import { Dimensions, StyleSheet } from "react-native";

const { width } = Dimensions.get("window");

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  galleryWrapper: {
    height: 420,
  },

  pager: {
    height: "100%",
  },

  image: {
    width: width,
    height: "100%",
  },

  gradient: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 160,
  },

  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },

  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 10,
    backgroundColor: "#555",
    marginHorizontal: 5,
  },

  activeDot: {
    backgroundColor: "#fff",
    width: 20,
  },

  infoCard: {
    marginHorizontal: 20,
    marginTop: -60,
    borderRadius: 24,
    padding: 24,
    overflow: "hidden",
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },

  subtitle: {
    fontSize: 16,
    color: "#bbb",
    marginTop: 6,
  },

  description: {
    marginTop: 12,
    fontSize: 15,
    color: "#ddd",
    lineHeight: 22,
  },

  thumbnailRow: {
    marginTop: 28,
    paddingLeft: 16,
  },

  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 14,
    marginRight: 10,
  },

  activeThumb: {
    borderWidth: 3,
    borderColor: "#fff",
  },

  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
});
