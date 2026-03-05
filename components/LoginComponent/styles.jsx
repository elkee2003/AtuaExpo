import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 24,
  },

  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 40,
  },

  header: {
    marginBottom: 32,
  },

  logo: {
    width: 90,
    height: 90,
    resizeMode: "contain",
    alignSelf: "center",
    marginBottom: 24,
  },

  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
  },

  subtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
  },

  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 10,
  },

  inputWrapper: {
    marginBottom: 20,
  },

  inputLabel: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 6,
  },

  inputContainer: {
    position: "relative",
  },

  input: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 18,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    color: "#0F172A",
  },

  errorBorder: {
    borderColor: "#EF4444",
  },

  eyeIcon: {
    position: "absolute",
    right: 16,
    top: 16,
  },

  errorText: {
    color: "#EF4444",
    fontSize: 13,
    marginTop: 6,
  },

  primaryButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  secondaryText: {
    textAlign: "center",
    marginTop: 18,
    fontSize: 14,
    color: "#2563EB",
    fontWeight: "500",
  },

  linkRow: {
    marginTop: 16,
    alignItems: "center",
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },

  checkboxText: {
    marginLeft: 8,
    flex: 1,
    fontSize: 13,
    color: "#475569",
  },
});

export default styles;
