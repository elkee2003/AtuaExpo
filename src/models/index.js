// @ts-check
import { initSchema } from '@aws-amplify/datastore';
import { schema } from './schema';

const FundsStatus = {
  "HELD": "HELD",
  "RELEASED": "RELEASED"
};

const OrderPayoutStatus = {
  "NOT_PAID": "NOT_PAID",
  "PAID": "PAID"
};

const OrderPaymentStatus = {
  "PENDING": "PENDING",
  "PAID": "PAID"
};

const PaymentStatus = {
  "PENDING": "PENDING",
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
  "FAILED": "FAILED"
};

const PayoutStatus = {
  "PENDING": "PENDING",
  "PROCESSING": "PROCESSING",
  "PAID": "PAID",
  "FAILED": "FAILED"
};

const OwnerType = {
  "COURIER": "COURIER",
  "USER": "USER"
};

const OfferStatus = {
  "ACTIVE": "ACTIVE",
  "ACCEPTED": "ACCEPTED",
  "REJECTED": "REJECTED"
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

const OrderStatus = {
  "BIDDING": "BIDDING",
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

const { CompanyVehicle, CourierCompany, Payout, Transaction, Wallet, Payment, Offer, Order, Courier, User } = initSchema(schema);

export {
  CompanyVehicle,
  CourierCompany,
  Payout,
  Transaction,
  Wallet,
  Payment,
  Offer,
  Order,
  Courier,
  User,
  FundsStatus,
  OrderPayoutStatus,
  OrderPaymentStatus,
  PaymentStatus,
  TransactionType,
  TransactionStatus,
  PayoutStatus,
  OwnerType,
  OfferStatus,
  CourierPreTransferUploadStatus,
  CourierPostLoadingUploadStatus,
  DropoffUploadStatus,
  MediaUploadStatus,
  OrderStatus
};