// @ts-check
import { initSchema } from '@aws-amplify/datastore';
import { schema } from './schema';

const PaystackEnvironment = {
  "TEST": "TEST",
  "LIVE": "LIVE"
};

const OrderEnvironment = {
  "PRODUCTION": "PRODUCTION",
  "TEST": "TEST"
};

const PaymentMethodStatus = {
  "ACTIVE": "ACTIVE",
  "INACTIVE": "INACTIVE",
  "EXPIRED": "EXPIRED",
  "FAILED": "FAILED"
};

const EarningsAllocationStatus = {
  "NOT_ALLOCATED": "NOT_ALLOCATED",
  "PROCESSING": "PROCESSING",
  "ALLOCATED": "ALLOCATED",
  "FAILED": "FAILED"
};

const FundsStatus = {
  "HELD": "HELD",
  "PARTIALLY_RELEASED": "PARTIALLY_RELEASED",
  "RELEASED": "RELEASED"
};

const OrderPayoutStatus = {
  "NOT_PAID": "NOT_PAID",
  "PAID": "PAID"
};

const OrderPaymentStatus = {
  "PENDING": "PENDING",
  "PROCESSING": "PROCESSING",
  "PAID": "PAID",
  "FAILED": "FAILED"
};

const PaymentStatus = {
  "PENDING": "PENDING",
  "PROCESSING": "PROCESSING",
  "SUCCESS": "SUCCESS",
  "FAILED": "FAILED"
};

const TransactionType = {
  "CREDIT": "CREDIT",
  "DEBIT": "DEBIT"
};

const TransactionStatus = {
  "PENDING": "PENDING",
  "COMPLETED": "COMPLETED",
  "FAILED": "FAILED",
  "REVERSED": "REVERSED"
};

const PayoutStatus = {
  "PENDING": "PENDING",
  "PROCESSING": "PROCESSING",
  "PAID": "PAID",
  "FAILED": "FAILED"
};

const PayoutSource = {
  "COURIER_REQUESTED": "COURIER_REQUESTED",
  "ADMIN_MANUAL": "ADMIN_MANUAL",
  "SYSTEM": "SYSTEM"
};

const OwnerType = {
  "COURIER": "COURIER",
  "USER": "USER"
};

const OfferStatus = {
  "ACTIVE": "ACTIVE",
  "ACCEPTED": "ACCEPTED",
  "REJECTED": "REJECTED",
  "CANCELLED": "CANCELLED"
};

const CourierPreTransferUploadStatus = {
  "PENDING": "PENDING",
  "UPLOADING": "UPLOADING",
  "COMPLETE": "COMPLETE",
  "FAILED": "FAILED"
};

const CourierPostLoadingUploadStatus = {
  "PENDING": "PENDING",
  "UPLOADING": "UPLOADING",
  "COMPLETE": "COMPLETE",
  "FAILED": "FAILED"
};

const DropoffUploadStatus = {
  "PENDING": "PENDING",
  "UPLOADING": "UPLOADING",
  "COMPLETE": "COMPLETE",
  "FAILED": "FAILED"
};

const MediaUploadStatus = {
  "PENDING": "PENDING",
  "UPLOADING": "UPLOADING",
  "COMPLETE": "COMPLETE",
  "FAILED": "FAILED"
};

const RefundStatus = {
  "NONE": "NONE",
  "PENDING": "PENDING",
  "PROCESSING": "PROCESSING",
  "NEEDS_ATTENTION": "NEEDS_ATTENTION",
  "PROCESSED": "PROCESSED",
  "FAILED": "FAILED"
};

const CancellationStage = {
  "BEFORE_ACCEPTANCE": "BEFORE_ACCEPTANCE",
  "ACCEPTED": "ACCEPTED",
  "COURIER_ARRIVED": "COURIER_ARRIVED",
  "PICKUP_STARTED": "PICKUP_STARTED",
  "PICKED_UP": "PICKED_UP",
  "IN_TRANSIT": "IN_TRANSIT",
  "DELIVERED": "DELIVERED"
};

const CancellationReason = {
  "CHANGED_MIND": "CHANGED_MIND",
  "WRONG_ADDRESS": "WRONG_ADDRESS",
  "WRONG_ORDER": "WRONG_ORDER",
  "TOO_EXPENSIVE": "TOO_EXPENSIVE",
  "TOO_LONG_TO_WAIT": "TOO_LONG_TO_WAIT",
  "NO_LONGER_NEEDED": "NO_LONGER_NEEDED",
  "COURIER_DELAY": "COURIER_DELAY",
  "COURIER_REQUEST": "COURIER_REQUEST",
  "SYSTEM_ERROR": "SYSTEM_ERROR",
  "OTHER": "OTHER"
};

const CancellationStatus = {
  "NONE": "NONE",
  "REQUESTED": "REQUESTED",
  "PROCESSING": "PROCESSING",
  "COMPLETED": "COMPLETED",
  "FAILED": "FAILED",
  "REJECTED": "REJECTED"
};

const OrderStatus = {
  "BIDDING": "BIDDING",
  "AWAITING_PAYMENT": "AWAITING_PAYMENT",
  "READY_FOR_PICKUP": "READY_FOR_PICKUP",
  "ACCEPTED": "ACCEPTED",
  "ARRIVED_PICKUP": "ARRIVED_PICKUP",
  "LOADING": "LOADING",
  "PICKED_UP": "PICKED_UP",
  "IN_TRANSIT": "IN_TRANSIT",
  "ARRIVED_DROPOFF": "ARRIVED_DROPOFF",
  "UNLOADING": "UNLOADING",
  "DELIVERED": "DELIVERED",
  "HANDOVER_TO_LOGISTICS": "HANDOVER_TO_LOGISTICS",
  "IN_LOGISTICS_TRANSIT": "IN_LOGISTICS_TRANSIT",
  "CANCELLED": "CANCELLED",
  "DISPUTED": "DISPUTED"
};

const CourierReportStatus = {
  "OPEN": "OPEN",
  "UNDER_REVIEW": "UNDER_REVIEW",
  "RESOLVED": "RESOLVED",
  "DISMISSED": "DISMISSED"
};

const { CompanyVehicle, CourierCompany, PaymentMethod, Payout, Transaction, Wallet, Payment, Offer, OrderCancellation, Order, CourierReport, CourierReview, AdminAlert, CourierLiveLocation, Courier, User, VerifyAtuaPaymentResult, VerifiedPaymentDetails, ChargeAtuaPaymentMethodResult, DeleteSavedPaymentMethodResult, ProcessPayoutsResponse, ReversePayoutResponse } = initSchema(schema);

export {
  CompanyVehicle,
  CourierCompany,
  PaymentMethod,
  Payout,
  Transaction,
  Wallet,
  Payment,
  Offer,
  OrderCancellation,
  Order,
  CourierReport,
  CourierReview,
  AdminAlert,
  CourierLiveLocation,
  Courier,
  User,
  PaystackEnvironment,
  OrderEnvironment,
  PaymentMethodStatus,
  EarningsAllocationStatus,
  FundsStatus,
  OrderPayoutStatus,
  OrderPaymentStatus,
  PaymentStatus,
  TransactionType,
  TransactionStatus,
  PayoutStatus,
  PayoutSource,
  OwnerType,
  OfferStatus,
  CourierPreTransferUploadStatus,
  CourierPostLoadingUploadStatus,
  DropoffUploadStatus,
  MediaUploadStatus,
  RefundStatus,
  CancellationStage,
  CancellationReason,
  CancellationStatus,
  OrderStatus,
  CourierReportStatus,
  VerifyAtuaPaymentResult,
  VerifiedPaymentDetails,
  ChargeAtuaPaymentMethodResult,
  DeleteSavedPaymentMethodResult,
  ProcessPayoutsResponse,
  ReversePayoutResponse
};