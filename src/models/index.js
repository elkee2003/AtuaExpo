// @ts-check
import { initSchema } from '@aws-amplify/datastore';
import { schema } from './schema';

const OfferStatus = {
  "ACTIVE": "ACTIVE",
  "ACCEPTED": "ACCEPTED",
  "REJECTED": "REJECTED"
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

const { CompanyVehicle, CourierCompany, Offer, Order, Courier, User } = initSchema(schema);

export {
  CompanyVehicle,
  CourierCompany,
  Offer,
  Order,
  Courier,
  User,
  OfferStatus,
  MediaUploadStatus,
  OrderStatus
};