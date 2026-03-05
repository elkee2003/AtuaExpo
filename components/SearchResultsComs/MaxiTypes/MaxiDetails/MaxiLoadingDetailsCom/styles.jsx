// /screens/freight/maxi/MaxiLoadingDetails.styles.js

import { StyleSheet } from "react-native";

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
    marginTop: 25,
    marginBottom: 12,
  },

  optionCard: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  selectedCard: {
    borderColor: "#111827",
    borderWidth: 2,
    backgroundColor: "#F1F5F9",
  },

  optionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1F2937",
  },

  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
    paddingVertical: 10,
  },

  summaryCard: {
    backgroundColor: "#0F172A",
    padding: 20,
    borderRadius: 18,
    marginTop: 30,
  },

  summaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
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
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
