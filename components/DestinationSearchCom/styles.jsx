import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f7f7",
  },

  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
  },

  searchCard: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
  },

  inputContainer: {
    marginVertical: 9,
  },

  textInput: {
    backgroundColor: "#f1f1f1",
    padding: 12,
    borderRadius: 10,
    fontSize: 15,
  },

  swapButton: {
    position: "absolute",
    right: 12,
    top: 52,
    backgroundColor: "#fff",
    padding: 6,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  iconContainer: {
    backgroundColor: "#4a4a4a",
    padding: 8,
    borderRadius: 20,
    marginRight: 12,
  },

  textContainer: {
    flex: 1,
  },

  locationTitle: {
    fontSize: 15,
    fontWeight: "500",
  },

  locationSubtitle: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },

  rightButtonContainer: {
    position: "absolute",
    right: 10,
    top: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  listView: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginTop: 5,
  },
});
