import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8f9fb",
  },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },

  distanceText: {
    fontSize: 14,
    color: "#6b7280",
  },

  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },

  selectedCard: {
    borderWidth: 2,
    borderColor: "#0aff5c",
    backgroundColor: "#defde8",
  },

  image: {
    height: 60,
    width: 70,
    resizeMode: "contain",
  },

  content: {
    flex: 1,
    marginHorizontal: 14,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  type: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  infoIcon: {
    marginLeft: 6,
  },

  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#6b7280",
  },

  priceContainer: {
    alignItems: "flex-end",
  },

  price: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  tag: {
    fontSize: 11,
    color: "#16a34a",
    marginTop: 4,
  },

  bottomBar: {
    position: "absolute",
    bottom: 70,
    width: "100%",
    padding: 20,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderColor: "#eeeeee",
  },

  confirmBtn: {
    backgroundColor: "#020e1a",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },

  confirmBtnDisabled: {
    backgroundColor: "#cbd5e1",
  },

  confirmTxt: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default styles;
