// @ts-check
import { initSchema } from '@aws-amplify/datastore';
import { schema } from './schema';

const OrderStatus = {
  "READY_FOR_PICKUP": "READY_FOR_PICKUP",
  "ACCEPTED": "ACCEPTED",
  "PICKEDUP": "PICKEDUP",
  "DELIVERED": "DELIVERED"
};

const { CourierCompany, CompanyVehicle, Order, Courier, User } = initSchema(schema);

export {
  CourierCompany,
  CompanyVehicle,
  Order,
  Courier,
  User,
  OrderStatus
};