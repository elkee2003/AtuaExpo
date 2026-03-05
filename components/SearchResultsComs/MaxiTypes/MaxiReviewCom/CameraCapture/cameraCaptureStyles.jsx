import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  camera: {
    flex: 1,
  },

  // ================= PERMISSION =================
  permissionContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  permissionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },

  permissionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
    color: "#111827",
  },

  permissionText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
  },

  permissionButton: {
    marginTop: 24,
    backgroundColor: "#111827",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },

  permissionButtonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 15,
  },

  // ================= TOP BAR =================
  topBar: {
    position: "absolute",
    top: 0,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },

  topIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },

  recordingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    marginRight: 6,
  },

  recordingText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },

  // ================= BOTTOM BAR =================
  bottomBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    alignItems: "center",
    paddingVertical: 30,
  },

  captureButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  recordingButton: {
    backgroundColor: "#EF4444",
  },

  timerText: {
    color: "#FF3B30",
    fontSize: 16,
    fontWeight: "700",
  },

  recordCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FF3B30",
  },

  innerCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#111827",
  },

  stopSquare: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#FFF",
  },

  //   Permission styles
  permissionContainer: {
    flex: 1,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },

  permissionContent: {
    alignItems: "center",
  },

  permissionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111",
    textAlign: "center",
    marginBottom: 10,
  },

  permissionSubtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 22,
  },

  permissionButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 10,
  },

  permissionButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default styles;
