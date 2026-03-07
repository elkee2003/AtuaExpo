import { Dimensions, StyleSheet } from "react-native";

const { width, height } = Dimensions.get("window");

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },

  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  header: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
  },

  status: {
    color: "#2563EB",
    fontWeight: "600",
  },

  mapContainer: {
    height: 200,
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: "hidden",
  },

  map: {
    flex: 1,
  },

  courierCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    margin: 20,
    borderRadius: 12,
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },

  courierName: {
    fontWeight: "600",
    fontSize: 16,
  },

  vehicle: {
    color: "#666",
  },

  contactButton: {
    backgroundColor: "#2563EB",
    padding: 10,
    borderRadius: 8,
  },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },

  sectionTitle: {
    fontWeight: "700",
    marginBottom: 10,
  },

  timelineItem: {
    flexDirection: "row",
    marginBottom: 10,
  },

  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2563EB",
    marginRight: 10,
    marginTop: 6,
  },

  timelineLabel: {
    fontWeight: "600",
  },

  timelineTime: {
    color: "#777",
  },

  total: {
    fontWeight: "700",
    marginTop: 10,
  },

  evidence: {
    width: 90,
    height: 90,
    borderRadius: 10,
    marginRight: 10,
  },

  actions: {
    padding: 20,
  },

  button: {
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: "center",
  },

  outlineButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#2563EB",
  },

  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },

  viewerContainer: {
    flex: 1,
    backgroundColor: "#000",
  },

  viewerPager: {
    flex: 1,
  },

  viewerPage: {
    justifyContent: "center",
    alignItems: "center",
  },

  viewerImage: {
    width,
    height,
  },

  close: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
  },
});
