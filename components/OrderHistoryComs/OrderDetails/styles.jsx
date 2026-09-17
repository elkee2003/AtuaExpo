import { Platform, StyleSheet } from "react-native";

/**
 * Atua Order Details Screen Styles
 *
 * These styles are designed for:
 * - A premium logistics experience
 * - Clear delivery status hierarchy
 * - Comfortable spacing
 * - Modern cards and rounded sections
 * - Responsive layouts on Android and iOS
 */

const COLORS = {
  background: "#F6F8FB",
  surface: "#FFFFFF",
  surfaceMuted: "#F0F3F7",

  text: "#102033",
  textSecondary: "#6B7785",
  textMuted: "#98A2B3",

  border: "#E5EAF0",
  borderStrong: "#D5DDE7",

  primary: "#0A9396",
  primaryDark: "#087477",
  primarySoft: "#E2F5F5",

  navy: "#071A3D",
  navySoft: "#EAF0FA",

  success: "#16803C",
  successSoft: "#E6F6EC",

  warning: "#B7791F",
  warningSoft: "#FFF4D6",

  danger: "#D92D20",
  dangerSoft: "#FEECEB",

  white: "#FFFFFF",
  black: "#000000",

  pickup: "#0A9396",
  dropoff: "#F26B5B",

  overlay: "rgba(7, 26, 61, 0.78)",
};

const styles = StyleSheet.create({
  // ---------------------------------------------------------------------------
  // Loading and empty states
  // ---------------------------------------------------------------------------

  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
  },

  loadingText: {
    marginTop: 14,
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },

  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
    marginBottom: 20,
  },

  emptyIconText: {
    fontSize: 34,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },

  emptyDescription: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 320,
  },

  emptyButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
  },

  emptyButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },

  // ---------------------------------------------------------------------------
  // Main screen
  // ---------------------------------------------------------------------------

  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 36,
  },

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------

  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 14 : 8,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  backIcon: {
    color: COLORS.navy,
    fontSize: 25,
    fontWeight: "400",
    marginTop: -2,
  },

  headerTitleContainer: {
    flex: 1,
    minWidth: 0,
  },

  headerEyebrow: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 3,
  },

  title: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  headerLogo: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  headerLogoText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: "900",
  },

  headerBottomRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  headerSubtitle: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },

  // ---------------------------------------------------------------------------
  // Status badge
  // ---------------------------------------------------------------------------

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft,
  },

  statusBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 6,
  },

  statusBadgeText: {
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },

  // ---------------------------------------------------------------------------
  // Overview card
  // ---------------------------------------------------------------------------

  overviewCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.navy,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.045,
    shadowRadius: 18,
    elevation: 2,
  },

  overviewTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  overviewLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: 7,
  },

  overviewLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },

  overviewOrderId: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 8,
  },

  overviewTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  overviewTitleContainer: {
    flex: 1,
    paddingRight: 12,
  },

  overviewTitle: {
    color: COLORS.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "900",
    letterSpacing: -0.6,
  },

  overviewDescription: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },

  overviewPackageIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: COLORS.navySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  overviewPackageEmoji: {
    fontSize: 27,
  },

  // ---------------------------------------------------------------------------
  // Map
  // ---------------------------------------------------------------------------

  mapContainer: {
    height: 215,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: COLORS.surfaceMuted,
    marginBottom: 14,
  },

  map: {
    flex: 1,
  },

  pickupMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: COLORS.pickup,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 4,
  },

  pickupMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.pickup,
  },

  dropoffMarker: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 17,
    backgroundColor: COLORS.dropoff,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: COLORS.white,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 4,
  },

  dropoffMarkerText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "900",
  },

  mapOverlayBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.overlay,
  },

  mapOverlayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#8DE4C0",
    marginRight: 6,
  },

  mapOverlayText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "800",
  },

  // ---------------------------------------------------------------------------
  // Route summary
  // ---------------------------------------------------------------------------

  routeSummary: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 18,
    padding: 13,
  },

  routeSummaryItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  routeIconPickup: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  routeIconPickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.pickup,
  },

  routeSummaryText: {
    flex: 1,
    minWidth: 0,
  },

  routeSummaryLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 3,
  },

  routeSummaryAddress: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },

  routeDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },

  routeDividerLine: {
    width: 1,
    height: 18,
    backgroundColor: COLORS.borderStrong,
    marginLeft: 14,
  },

  routeIconDropoff: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFF0ED",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  routeIconDropoffText: {
    color: COLORS.dropoff,
    fontSize: 15,
    fontWeight: "900",
  },

  // ---------------------------------------------------------------------------
  // Buttons
  // ---------------------------------------------------------------------------

  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: 18,
    marginTop: 14,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
  },

  primaryButtonArrow: {
    color: COLORS.white,
    fontSize: 19,
    fontWeight: "600",
    marginLeft: 10,
  },

  secondaryButton: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },

  // ---------------------------------------------------------------------------
  // Courier card
  // ---------------------------------------------------------------------------

  courierCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 17,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  courierCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  cardEyebrow: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.successSoft,
  },

  verifiedBadgeText: {
    color: COLORS.success,
    fontSize: 10,
    fontWeight: "900",
  },

  courierProfileRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  courierAvatarContainer: {
    position: "relative",
    width: 64,
    height: 64,
    marginRight: 12,
  },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceMuted,
  },

  onlineIndicator: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: COLORS.success,
    borderWidth: 3,
    borderColor: COLORS.white,
  },

  courierInfo: {
    flex: 1,
    minWidth: 0,
  },

  courierName: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 4,
  },

  vehicle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 3,
  },

  courierSubtext: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "500",
  },

  courierContactButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  contactButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
  },

  contactButtonIcon: {
    color: COLORS.primaryDark,
    fontSize: 18,
    fontWeight: "900",
  },

  phoneCopyRow: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  phoneCopyLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 4,
  },

  phoneCopyRight: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
  },

  phoneCopyNumber: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
    marginRight: 8,
  },

  phoneCopyIcon: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: "900",
  },

  // ---------------------------------------------------------------------------
  // Generic section cards
  // ---------------------------------------------------------------------------

  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },

  sectionCardHeader: {
    paddingHorizontal: 17,
    paddingTop: 17,
    paddingBottom: 4,
  },

  sectionCardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
  },

  // ---------------------------------------------------------------------------
  // Delivery timeline
  // ---------------------------------------------------------------------------

  timelineHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  timelineHeaderIconText: {
    color: COLORS.primaryDark,
    fontSize: 17,
    fontWeight: "900",
  },

  timeline: {
    paddingHorizontal: 17,
    paddingTop: 17,
    paddingBottom: 18,
  },

  timelineItem: {
    flexDirection: "row",
    minHeight: 64,
  },

  timelineRail: {
    width: 30,
    alignItems: "center",
    marginRight: 12,
  },

  timelineDot: {
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  timelineDotCompleted: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  timelineDotPending: {
    backgroundColor: COLORS.surfaceMuted,
    borderColor: COLORS.borderStrong,
  },

  timelineCheck: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
  },

  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 28,
    marginTop: 4,
  },

  timelineLineCompleted: {
    backgroundColor: "#B8E4E4",
  },

  timelineLinePending: {
    backgroundColor: COLORS.border,
  },

  timelineContent: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 20,
  },

  timelineTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  timelineLabel: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },

  timelineLabelPending: {
    color: COLORS.textMuted,
  },

  timelineCompletedText: {
    color: COLORS.success,
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 6,
  },

  timelineDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  timelineTime: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 5,
  },

  // ---------------------------------------------------------------------------
  // Recipient tracking link
  // ---------------------------------------------------------------------------

  trackingLinkCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },

  trackingLinkHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 17,
    paddingTop: 17,
    paddingBottom: 14,
  },

  trackingLinkIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  trackingLinkIconText: {
    color: COLORS.primaryDark,
    fontSize: 18,
    fontWeight: "900",
  },

  trackingLinkHeaderText: {
    flex: 1,
    minWidth: 0,
  },

  trackingLinkEyebrow: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 3,
  },

  trackingLinkTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
  },

  trackingLinkContent: {
    paddingHorizontal: 17,
    paddingBottom: 17,
  },

  trackingLinkDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 13,
  },

  trackingLinkPreview: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  trackingLinkText: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  trackingLinkActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 13,
  },

  trackingLinkActionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  trackingLinkCopyButton: {
    backgroundColor: COLORS.primary,
  },

  trackingLinkShareButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },

  trackingLinkCopyButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "900",
  },

  trackingLinkShareButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "900",
  },

  // ---------------------------------------------------------------------------
  // Collapsible section headers
  // ---------------------------------------------------------------------------

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 17,
    paddingVertical: 17,
  },

  sectionHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  sectionHeaderIconText: {
    color: COLORS.navy,
    fontSize: 17,
    fontWeight: "900",
  },

  sectionHeaderLeft: {
    flex: 1,
    minWidth: 0,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
  },

  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  chevronContainerOpen: {
    backgroundColor: COLORS.primarySoft,
  },

  chevron: {
    color: COLORS.textSecondary,
    fontSize: 18,
    fontWeight: "800",
  },

  sectionContent: {
    paddingHorizontal: 17,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  // ---------------------------------------------------------------------------
  // Detail rows
  // ---------------------------------------------------------------------------

  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 14,
  },

  detailLabel: {
    flex: 0.9,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },

  detailValueContainer: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-end",
    minWidth: 0,
  },

  detailValue: {
    flexShrink: 1,
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "right",
  },

  detailValueMultiline: {
    flexShrink: 1,
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 19,
    fontWeight: "700",
    textAlign: "right",
  },

  detailCopyButton: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
    marginLeft: 8,
  },

  detailCopyIcon: {
    color: COLORS.primaryDark,
    fontSize: 14,
    fontWeight: "900",
  },

  // ---------------------------------------------------------------------------
  // Verification code
  // ---------------------------------------------------------------------------

  verificationContainer: {
    marginTop: 16,
    padding: 14,
    borderRadius: 17,
    backgroundColor: COLORS.navySoft,
  },

  verificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },

  verificationLabel: {
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: "900",
  },

  verificationHint: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 12,
  },

  verificationCodeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.white,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#D9E3F2",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },

  verificationCode: {
    color: COLORS.navy,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 4,
  },

  verificationCopy: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "900",
  },

  // ---------------------------------------------------------------------------
  // Pricing
  // ---------------------------------------------------------------------------

  totalContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: COLORS.navy,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  totalLabel: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
  },

  totalSubtext: {
    color: "#B8C6DD",
    fontSize: 11,
    marginTop: 4,
  },

  total: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  // ---------------------------------------------------------------------------
  // Evidence
  // ---------------------------------------------------------------------------

  evidenceDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 14,
    marginBottom: 14,
  },

  evidenceList: {
    gap: 12,
  },

  evidenceItem: {
    marginBottom: 4,
  },

  evidence: {
    width: "100%",
    height: 190,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceMuted,
  },

  evidenceOverlay: {
    position: "absolute",
    left: 10,
    bottom: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.overlay,
  },

  evidenceOverlayText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "800",
  },

  evidenceNumber: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },

  evidenceNumberText: {
    color: COLORS.navy,
    fontSize: 11,
    fontWeight: "900",
  },

  // ---------------------------------------------------------------------------
  // Bottom actions
  // ---------------------------------------------------------------------------

  actions: {
    marginTop: 4,
    gap: 10,
  },

  completedBanner: {
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "#EAF8EF",
  },

  completedBannerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: "#D5F2DE",
    marginBottom: 12,
  },

  completedBannerText: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },

  completedBannerTitle: {
    textAlign: "center",
    alignSelf: "center",
    fontSize: 20,
    fontWeight: "800",
    color: "#166534",
    marginBottom: 6,
  },

  completedBannerSubtitle: {
    textAlign: "center",
    alignSelf: "center",
    fontSize: 14,
    lineHeight: 21,
    color: "#3F6B4D",
  },

  // ---------------------------------------------------------------------------
  // Fullscreen evidence viewer
  // ---------------------------------------------------------------------------

  viewerContainer: {
    flex: 1,
    backgroundColor: COLORS.black,
  },

  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 18 : 12,
    paddingBottom: 12,
  },

  viewerEyebrow: {
    color: "#AEB8C7",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  viewerCounter: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3,
  },

  close: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  closeText: {
    color: COLORS.white,
    fontSize: 25,
    fontWeight: "400",
  },

  viewerPager: {
    flex: 1,
  },

  viewerPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  viewerImage: {
    width: "100%",
    height: "82%",
  },

  viewerFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "center",
  },

  viewerFooterText: {
    color: "#AEB8C7",
    fontSize: 12,
    textAlign: "center",
  },
});
export default styles;
