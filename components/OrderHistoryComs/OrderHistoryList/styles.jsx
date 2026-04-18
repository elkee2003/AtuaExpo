import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  cardActive: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  expandHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#9CA3AF",
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  date: {
    fontSize: 13,
    color: "#6B7280",
  },

  liveBadge: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },

  liveText: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },

  statusDelivered: { backgroundColor: "#16A34A" },
  statusActive: { backgroundColor: "#2563EB" },
  statusPending: { backgroundColor: "#F59E0B" },
  statusCancelled: { backgroundColor: "#DC2626" },

  recipient: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
    color: "#111827",
  },

  details: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    lineHeight: 20,
  },

  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 14,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  price: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  transport: {
    fontSize: 13,
    color: "#6B7280",
    textTransform: "capitalize",
  },

  expandedContent: {
    marginTop: 10,
  },

  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },

  primaryButton: {
    flex: 1,
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  primaryText: {
    color: "#fff",
    fontWeight: "600",
  },

  secondaryButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  secondaryText: {
    color: "#111827",
    fontWeight: "600",
  },

  dangerButton: {
    marginTop: 12,
    backgroundColor: "#FEF2F2",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  dangerText: {
    color: "#DC2626",
    fontWeight: "600",
  },

  warningButton: {
    marginTop: 12,
    backgroundColor: "#FFF7ED",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  warningText: {
    color: "#EA580C",
    fontWeight: "600",
  },
});

export default styles;
