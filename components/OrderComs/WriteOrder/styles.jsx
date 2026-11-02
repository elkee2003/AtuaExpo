import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  scrollContainer: {
    padding: 24,
    paddingBottom: 40,
  },

  headerContainer: {
    marginBottom: 28,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },

  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 6,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 30,
  },

  inputGroup: {
    marginBottom: 20,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },

  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    fontSize: 14,
    backgroundColor: "#F9FAFB",
    color: "#111827",
  },

  textArea: {
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingTop: 14,
    fontSize: 14,
    backgroundColor: "#F9FAFB",
    color: "#111827",
    textAlignVertical: "top",
  },

  inputError: {
    borderColor: "#EF4444",
  },

  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 6,
  },

  button: {
    height: 56,
    backgroundColor: "#111827",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },

  buttonDisabled: {
    backgroundColor: "#9CA3AF",
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  paymentDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 19,
    marginBottom: 14,
  },

  paymentSubheading: {
    marginTop: 22,
    marginBottom: 12,
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  paymentOptionIconSelected: {
    backgroundColor: "#E5E7EB",
  },

  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },

  paymentOptionSelected: {
    borderColor: "#111827",
    backgroundColor: "#F3F4F6",
  },

  paymentOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  paymentOptionContent: {
    flex: 1,
  },

  paymentOptionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },

  paymentOptionDescription: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 17,
    marginTop: 4,
    flexShrink: 1,
  },

  paymentNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
  },

  paymentNoticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 6,
  },

  paymentNoticeText: {
    fontSize: 12,
    color: "#78350F",
    lineHeight: 18,
    marginBottom: 6,
  },
});

export default styles;
