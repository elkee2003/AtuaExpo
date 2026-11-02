import { StyleSheet } from "react-native";

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 20,
  },

  scrollContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
  },

  input: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    fontSize: 14,
    color: "#0F172A",
  },

  payerSection: {
    marginTop: 12,
    marginBottom: 12,
  },

  payerSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: "#64748B",
    marginTop: -4,
    marginBottom: 16,
  },

  payerOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
  },

  payerOptionSelected: {
    borderColor: "#0F766E",
    backgroundColor: "#F0FDFA",
  },

  payerIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  payerIcon: {
    fontSize: 20,
  },

  payerOptionText: {
    flex: 1,
    paddingRight: 8,
  },

  payerOptionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },

  payerOptionDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: "#64748B",
  },

  radioOuter: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },

  radioOuterSelected: {
    borderColor: "#0F766E",
  },

  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#0F766E",
  },

  payerNotice: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 12,
    marginTop: 2,
  },

  payerNoticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#92400E",
  },

  error: {
    color: "#DC2626",
    marginTop: 10,
    fontSize: 13,
  },

  primaryButton: {
    backgroundColor: "#0F172A",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginVertical: 15,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  paymentArrangementHeading: {
    marginTop: 12,
    marginBottom: 4,
  },

  paymentArrangementOption: {
    // Keeps payment options consistent with the payer cards.
    marginBottom: 12,
  },

  paymentValidationHint: {
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
    marginTop: 4,
  },

  // Sender payment method options
  paymentMethodsContainer: {
    marginTop: 16,
  },

  // Receiver payment information
  receiverPaymentNotice: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 12,
  },

  receiverPaymentNoticeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 8,
  },

  receiverPaymentNoticeText: {
    fontSize: 12,
    lineHeight: 19,
    color: "#92400E",
    marginBottom: 8,
  },

  receiverPaymentWarning: {
    fontSize: 12,
    lineHeight: 19,
    fontWeight: "600",
    color: "#92400E",
    marginTop: 2,
  },
});
