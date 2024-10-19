import { ModelInit, MutableModel, __modelMeta__, ManagedIdentifier } from "@aws-amplify/datastore";
// @ts-ignore
import { LazyLoading, LazyLoadingDisabled, AsyncCollection, AsyncItem } from "@aws-amplify/datastore";

export enum OrderStatus {
  READY_FOR_PICKUP = "READY_FOR_PICKUP",
  ACCEPTED = "ACCEPTED",
  PICKEDUP = "PICKEDUP",
  DELIVERED = "DELIVERED"
}



type EagerCourierCompany = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<CourierCompany, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly sub: string;
  readonly firstName: string;
  readonly lastName?: string | null;
  readonly profilePic?: string | null;
  readonly address?: string | null;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly landmark?: string | null;
  readonly phoneNumber?: string | null;
  readonly email?: string | null;
  readonly adminFirstName?: string | null;
  readonly adminLastName?: string | null;
  readonly adminPhoneNumber?: string | null;
  readonly bankName?: string | null;
  readonly CompanyVehicles?: (CompanyVehicle | null)[] | null;
  readonly accountNumber?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyCourierCompany = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<CourierCompany, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly sub: string;
  readonly firstName: string;
  readonly lastName?: string | null;
  readonly profilePic?: string | null;
  readonly address?: string | null;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly landmark?: string | null;
  readonly phoneNumber?: string | null;
  readonly email?: string | null;
  readonly adminFirstName?: string | null;
  readonly adminLastName?: string | null;
  readonly adminPhoneNumber?: string | null;
  readonly bankName?: string | null;
  readonly CompanyVehicles: AsyncCollection<CompanyVehicle>;
  readonly accountNumber?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type CourierCompany = LazyLoading extends LazyLoadingDisabled ? EagerCourierCompany : LazyCourierCompany

export declare const CourierCompany: (new (init: ModelInit<CourierCompany>) => CourierCompany) & {
  copyOf(source: CourierCompany, mutator: (draft: MutableModel<CourierCompany>) => MutableModel<CourierCompany> | void): CourierCompany;
}

type EagerCompanyVehicle = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<CompanyVehicle, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly vehicleType?: string | null;
  readonly model?: string | null;
  readonly plateNumber?: string | null;
  readonly couriercompanyID: string;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyCompanyVehicle = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<CompanyVehicle, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly vehicleType?: string | null;
  readonly model?: string | null;
  readonly plateNumber?: string | null;
  readonly couriercompanyID: string;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type CompanyVehicle = LazyLoading extends LazyLoadingDisabled ? EagerCompanyVehicle : LazyCompanyVehicle

export declare const CompanyVehicle: (new (init: ModelInit<CompanyVehicle>) => CompanyVehicle) & {
  copyOf(source: CompanyVehicle, mutator: (draft: MutableModel<CompanyVehicle>) => MutableModel<CompanyVehicle> | void): CompanyVehicle;
}

type EagerOrder = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Order, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly recipientName?: string | null;
  readonly recipientNumber?: string | null;
  readonly orderDetails?: string | null;
  readonly parcelOrigin?: string | null;
  readonly parcelOriginLat?: number | null;
  readonly parcelOriginLng?: number | null;
  readonly parcelDestination?: string | null;
  readonly parcelDestinationLat?: number | null;
  readonly parcelDestinationLng?: number | null;
  readonly transportationType?: string | null;
  readonly status?: OrderStatus | keyof typeof OrderStatus | null;
  readonly price?: number | null;
  readonly userID: string;
  readonly Courier?: Courier | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  readonly orderCourierId?: string | null;
}

type LazyOrder = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Order, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly recipientName?: string | null;
  readonly recipientNumber?: string | null;
  readonly orderDetails?: string | null;
  readonly parcelOrigin?: string | null;
  readonly parcelOriginLat?: number | null;
  readonly parcelOriginLng?: number | null;
  readonly parcelDestination?: string | null;
  readonly parcelDestinationLat?: number | null;
  readonly parcelDestinationLng?: number | null;
  readonly transportationType?: string | null;
  readonly status?: OrderStatus | keyof typeof OrderStatus | null;
  readonly price?: number | null;
  readonly userID: string;
  readonly Courier: AsyncItem<Courier | undefined>;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  readonly orderCourierId?: string | null;
}

export declare type Order = LazyLoading extends LazyLoadingDisabled ? EagerOrder : LazyOrder

export declare const Order: (new (init: ModelInit<Order>) => Order) & {
  copyOf(source: Order, mutator: (draft: MutableModel<Order>) => MutableModel<Order> | void): Order;
}

type EagerCourier = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Courier, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly sub: string;
  readonly firstName: string;
  readonly lastName?: string | null;
  readonly profilePic?: string | null;
  readonly address?: string | null;
  readonly landMark?: string | null;
  readonly phoneNumber?: string | null;
  readonly email?: string | null;
  readonly courierNIN?: string | null;
  readonly courierBVN?: string | null;
  readonly bankName?: string | null;
  readonly accountName?: string | null;
  readonly accountNumber?: string | null;
  readonly transportationType?: string | null;
  readonly VehicleType?: string | null;
  readonly model?: string | null;
  readonly plateNumber?: string | null;
  readonly guarantorName?: string | null;
  readonly guarantorLastName?: string | null;
  readonly guarantorProfession?: string | null;
  readonly guarantorNumber?: string | null;
  readonly guarantorRelationship?: string | null;
  readonly guarantorAddress?: string | null;
  readonly guarantorEmail?: string | null;
  readonly guarantorNIN?: string | null;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly heading?: number | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyCourier = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Courier, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly sub: string;
  readonly firstName: string;
  readonly lastName?: string | null;
  readonly profilePic?: string | null;
  readonly address?: string | null;
  readonly landMark?: string | null;
  readonly phoneNumber?: string | null;
  readonly email?: string | null;
  readonly courierNIN?: string | null;
  readonly courierBVN?: string | null;
  readonly bankName?: string | null;
  readonly accountName?: string | null;
  readonly accountNumber?: string | null;
  readonly transportationType?: string | null;
  readonly VehicleType?: string | null;
  readonly model?: string | null;
  readonly plateNumber?: string | null;
  readonly guarantorName?: string | null;
  readonly guarantorLastName?: string | null;
  readonly guarantorProfession?: string | null;
  readonly guarantorNumber?: string | null;
  readonly guarantorRelationship?: string | null;
  readonly guarantorAddress?: string | null;
  readonly guarantorEmail?: string | null;
  readonly guarantorNIN?: string | null;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly heading?: number | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type Courier = LazyLoading extends LazyLoadingDisabled ? EagerCourier : LazyCourier

export declare const Courier: (new (init: ModelInit<Courier>) => Courier) & {
  copyOf(source: Courier, mutator: (draft: MutableModel<Courier>) => MutableModel<Courier> | void): Courier;
}

type EagerUser = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<User, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly sub: string;
  readonly firstName: string;
  readonly lastName?: string | null;
  readonly phoneNumber?: string | null;
  readonly profilePic?: string | null;
  readonly address?: string | null;
  readonly exactAddress?: string | null;
  readonly Orders?: (Order | null)[] | null;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyUser = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<User, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly sub: string;
  readonly firstName: string;
  readonly lastName?: string | null;
  readonly phoneNumber?: string | null;
  readonly profilePic?: string | null;
  readonly address?: string | null;
  readonly exactAddress?: string | null;
  readonly Orders: AsyncCollection<Order>;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type User = LazyLoading extends LazyLoadingDisabled ? EagerUser : LazyUser

export declare const User: (new (init: ModelInit<User>) => User) & {
  copyOf(source: User, mutator: (draft: MutableModel<User>) => MutableModel<User> | void): User;
}