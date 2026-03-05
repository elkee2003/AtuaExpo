// /screens/freight/maxi/MaxiCargoDetails.styles.js

import { StyleSheet } from "react-native";

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 25,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
    marginTop: 20,
    marginBottom: 10,
  },

  optionCard: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  selectedCard: {
    borderColor: "#111827",
    borderWidth: 2,
    backgroundColor: "#F1F5F9",
  },

  optionText: {
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "500",
  },

  textArea: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    minHeight: 130,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    textAlignVertical: "top",
    fontSize: 14,
    color: "#0F172A",
  },

  error: {
    color: "red",
    marginTop: 10,
    fontSize: 14,
  },

  primaryButton: {
    backgroundColor: "#111827",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginVertical: 15,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
