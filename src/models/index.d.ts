import { ModelInit, MutableModel, __modelMeta__, ManagedIdentifier } from "@aws-amplify/datastore";
// @ts-ignore
import { LazyLoading, LazyLoadingDisabled, AsyncCollection, AsyncItem } from "@aws-amplify/datastore";

export enum OfferStatus {
  ACTIVE = "ACTIVE",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED"
}

export enum MediaUploadStatus {
  PENDING = "PENDING",
  UPLOADING = "UPLOADING",
  COMPLETE = "COMPLETE",
  FAILED = "FAILED"
}

export enum OrderStatus {
  BIDDING = "BIDDING",
  READY_FOR_PICKUP = "READY_FOR_PICKUP",
  ACCEPTED = "ACCEPTED",
  ARRIVED_PICKUP = "ARRIVED_PICKUP",
  LOADING = "LOADING",
  PICKED_UP = "PICKED_UP",
  IN_TRANSIT = "IN_TRANSIT",
  ARRIVED_DROPOFF = "ARRIVED_DROPOFF",
  UNLOADING = "UNLOADING",
  DELIVERED = "DELIVERED",
  HANDOVER_TO_LOGISTICS = "HANDOVER_TO_LOGISTICS",
  IN_LOGISTICS_TRANSIT = "IN_LOGISTICS_TRANSIT",
  CANCELLED = "CANCELLED",
  DISPUTED = "DISPUTED"
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
  readonly push_token?: string | null;
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
  readonly push_token?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type CourierCompany = LazyLoading extends LazyLoadingDisabled ? EagerCourierCompany : LazyCourierCompany

export declare const CourierCompany: (new (init: ModelInit<CourierCompany>) => CourierCompany) & {
  copyOf(source: CourierCompany, mutator: (draft: MutableModel<CourierCompany>) => MutableModel<CourierCompany> | void): CourierCompany;
}

type EagerOffer = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Offer, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly orderID?: string | null;
  readonly order?: Order | null;
  readonly courierID?: string | null;
  readonly courier?: Courier | null;
  readonly senderType?: string | null;
  readonly amount?: number | null;
  readonly status?: OfferStatus | keyof typeof OfferStatus | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyOffer = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Offer, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly orderID?: string | null;
  readonly order: AsyncItem<Order | undefined>;
  readonly courierID?: string | null;
  readonly courier: AsyncItem<Courier | undefined>;
  readonly senderType?: string | null;
  readonly amount?: number | null;
  readonly status?: OfferStatus | keyof typeof OfferStatus | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type Offer = LazyLoading extends LazyLoadingDisabled ? EagerOffer : LazyOffer

export declare const Offer: (new (init: ModelInit<Offer>) => Offer) & {
  copyOf(source: Offer, mutator: (draft: MutableModel<Offer>) => MutableModel<Offer> | void): Offer;
}

type EagerOrder = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Order, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly recipientName?: string | null;
  readonly recipientNumber?: string | null;
  readonly recipientNumber2?: string | null;
  readonly orderDetails?: string | null;
  readonly originAddress?: string | null;
  readonly originState?: string | null;
  readonly originLat?: number | null;
  readonly originLng?: number | null;
  readonly destinationAddress?: string | null;
  readonly destinationState?: string | null;
  readonly destinationLat?: number | null;
  readonly destinationLng?: number | null;
  readonly tripType?: string | null;
  readonly distance?: string | null;
  readonly transportationType?: string | null;
  readonly vehicleClass?: string | null;
  readonly status?: OrderStatus | keyof typeof OrderStatus | null;
  readonly loadCategory?: string | null;
  readonly isInterState?: boolean | null;
  readonly estimatedMinPrice?: number | null;
  readonly estimatedMaxPrice?: number | null;
  readonly initialOfferPrice?: number | null;
  readonly currentOfferPrice?: number | null;
  readonly lastOfferBy?: string | null;
  readonly loadingFee?: number | null;
  readonly unloadingFee?: number | null;
  readonly floorSurcharge?: number | null;
  readonly fragileSurcharge?: number | null;
  readonly extrasTotal?: number | null;
  readonly totalPrice?: number | null;
  readonly courierEarnings?: number | null;
  readonly commissionAmount?: number | null;
  readonly platformFee?: number | null;
  readonly platformServiceRevenue?: number | null;
  readonly vatAmount?: number | null;
  readonly platformNetRevenue?: number | null;
  readonly deliveryVerificationCode?: string | null;
  readonly declaredWeightBracket?: string | null;
  readonly senderPreTransferPhotos?: (string | null)[] | null;
  readonly senderPreTransferVideo?: string | null;
  readonly senderPreTransferRecordedAt?: string | null;
  readonly senderPreTransferLocalPhotos?: (string | null)[] | null;
  readonly senderPreTransferLocalVideo?: string | null;
  readonly mediaUploadStatus?: MediaUploadStatus | keyof typeof MediaUploadStatus | null;
  readonly courierPreTransferPhotos?: (string | null)[] | null;
  readonly courierPreTransferVideo?: string | null;
  readonly courierPreTransferRecordedAt?: string | null;
  readonly courierPostLoadingPhotos?: (string | null)[] | null;
  readonly courierPostLoadingVideo?: string | null;
  readonly dropoffArrivalPhotos?: (string | null)[] | null;
  readonly dropoffArrivalVideo?: string | null;
  readonly postDeliveryPhotos?: (string | null)[] | null;
  readonly postDeliveryVideo?: string | null;
  readonly pickupLoadingResponsibility?: string | null;
  readonly pickupFloorLevel?: string | null;
  readonly pickupFloorLevelPrice?: number | null;
  readonly pickupHasElevator?: boolean | null;
  readonly dropoffUnloadingResponsibility?: string | null;
  readonly dropoffFloorLevel?: string | null;
  readonly dropoffFloorLevelPrice?: number | null;
  readonly dropoffHasElevator?: boolean | null;
  readonly acceptedAt?: string | null;
  readonly arrivedPickupAt?: string | null;
  readonly loadingStartedAt?: string | null;
  readonly tripStartedAt?: string | null;
  readonly arrivedDropoffAt?: string | null;
  readonly unloadingCompletedAt?: string | null;
  readonly logisticsCompanyId?: string | null;
  readonly waybillNumber?: string | null;
  readonly waybillPhoto?: string | null;
  readonly logisticsTrackingCode?: string | null;
  readonly logisticsTrackingStatus?: string | null;
  readonly handedOverToLogisticsAt?: string | null;
  readonly logisticsIntakeConfirmedAt?: string | null;
  readonly acceptedOfferID?: string | null;
  readonly assignedCourierId?: string | null;
  readonly assignmentExpiresAt?: string | null;
  readonly assignmentAttempts?: number | null;
  readonly lastAssignedAt?: string | null;
  readonly rejectedCourierIds?: (string | null)[] | null;
  readonly assignmentStatus?: string | null;
  readonly userID: string;
  readonly offers?: (Offer | null)[] | null;
  readonly assignedCourier?: Courier | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyOrder = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Order, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly recipientName?: string | null;
  readonly recipientNumber?: string | null;
  readonly recipientNumber2?: string | null;
  readonly orderDetails?: string | null;
  readonly originAddress?: string | null;
  readonly originState?: string | null;
  readonly originLat?: number | null;
  readonly originLng?: number | null;
  readonly destinationAddress?: string | null;
  readonly destinationState?: string | null;
  readonly destinationLat?: number | null;
  readonly destinationLng?: number | null;
  readonly tripType?: string | null;
  readonly distance?: string | null;
  readonly transportationType?: string | null;
  readonly vehicleClass?: string | null;
  readonly status?: OrderStatus | keyof typeof OrderStatus | null;
  readonly loadCategory?: string | null;
  readonly isInterState?: boolean | null;
  readonly estimatedMinPrice?: number | null;
  readonly estimatedMaxPrice?: number | null;
  readonly initialOfferPrice?: number | null;
  readonly currentOfferPrice?: number | null;
  readonly lastOfferBy?: string | null;
  readonly loadingFee?: number | null;
  readonly unloadingFee?: number | null;
  readonly floorSurcharge?: number | null;
  readonly fragileSurcharge?: number | null;
  readonly extrasTotal?: number | null;
  readonly totalPrice?: number | null;
  readonly courierEarnings?: number | null;
  readonly commissionAmount?: number | null;
  readonly platformFee?: number | null;
  readonly platformServiceRevenue?: number | null;
  readonly vatAmount?: number | null;
  readonly platformNetRevenue?: number | null;
  readonly deliveryVerificationCode?: string | null;
  readonly declaredWeightBracket?: string | null;
  readonly senderPreTransferPhotos?: (string | null)[] | null;
  readonly senderPreTransferVideo?: string | null;
  readonly senderPreTransferRecordedAt?: string | null;
  readonly senderPreTransferLocalPhotos?: (string | null)[] | null;
  readonly senderPreTransferLocalVideo?: string | null;
  readonly mediaUploadStatus?: MediaUploadStatus | keyof typeof MediaUploadStatus | null;
  readonly courierPreTransferPhotos?: (string | null)[] | null;
  readonly courierPreTransferVideo?: string | null;
  readonly courierPreTransferRecordedAt?: string | null;
  readonly courierPostLoadingPhotos?: (string | null)[] | null;
  readonly courierPostLoadingVideo?: string | null;
  readonly dropoffArrivalPhotos?: (string | null)[] | null;
  readonly dropoffArrivalVideo?: string | null;
  readonly postDeliveryPhotos?: (string | null)[] | null;
  readonly postDeliveryVideo?: string | null;
  readonly pickupLoadingResponsibility?: string | null;
  readonly pickupFloorLevel?: string | null;
  readonly pickupFloorLevelPrice?: number | null;
  readonly pickupHasElevator?: boolean | null;
  readonly dropoffUnloadingResponsibility?: string | null;
  readonly dropoffFloorLevel?: string | null;
  readonly dropoffFloorLevelPrice?: number | null;
  readonly dropoffHasElevator?: boolean | null;
  readonly acceptedAt?: string | null;
  readonly arrivedPickupAt?: string | null;
  readonly loadingStartedAt?: string | null;
  readonly tripStartedAt?: string | null;
  readonly arrivedDropoffAt?: string | null;
  readonly unloadingCompletedAt?: string | null;
  readonly logisticsCompanyId?: string | null;
  readonly waybillNumber?: string | null;
  readonly waybillPhoto?: string | null;
  readonly logisticsTrackingCode?: string | null;
  readonly logisticsTrackingStatus?: string | null;
  readonly handedOverToLogisticsAt?: string | null;
  readonly logisticsIntakeConfirmedAt?: string | null;
  readonly acceptedOfferID?: string | null;
  readonly assignedCourierId?: string | null;
  readonly assignmentExpiresAt?: string | null;
  readonly assignmentAttempts?: number | null;
  readonly lastAssignedAt?: string | null;
  readonly rejectedCourierIds?: (string | null)[] | null;
  readonly assignmentStatus?: string | null;
  readonly userID: string;
  readonly offers: AsyncCollection<Offer>;
  readonly assignedCourier: AsyncItem<Courier | undefined>;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
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
  readonly isOnline?: boolean | null;
  readonly firstName: string;
  readonly lastName?: string | null;
  readonly profilePic?: string | null;
  readonly address?: string | null;
  readonly landMark?: string | null;
  readonly phoneNumber?: string | null;
  readonly email?: string | null;
  readonly courierNIN?: string | null;
  readonly courierNINImage?: string | null;
  readonly bankCode?: string | null;
  readonly bankName?: string | null;
  readonly accountName?: string | null;
  readonly accountNumber?: string | null;
  readonly transportationType?: string | null;
  readonly vehicleClass?: string | null;
  readonly model?: string | null;
  readonly vehicleColour?: string | null;
  readonly plateNumber?: string | null;
  readonly maxiImages?: (string | null)[] | null;
  readonly maxiDescription?: string | null;
  readonly guarantorName?: string | null;
  readonly guarantorLastName?: string | null;
  readonly guarantorProfession?: string | null;
  readonly guarantorNumber?: string | null;
  readonly guarantorRelationship?: string | null;
  readonly guarantorAddress?: string | null;
  readonly guarantorEmail?: string | null;
  readonly guarantorNIN?: string | null;
  readonly guarantorNINImage?: string | null;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly heading?: number | null;
  readonly push_token?: string | null;
  readonly isApproved?: boolean | null;
  readonly approvedById?: string | null;
  readonly currentBatchCount?: number | null;
  readonly currentExpressCount?: number | null;
  readonly lastBatchAssignedAt?: string | null;
  readonly statusKey?: string | null;
  readonly offers?: (Offer | null)[] | null;
  readonly orders?: (Order | null)[] | null;
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
  readonly isOnline?: boolean | null;
  readonly firstName: string;
  readonly lastName?: string | null;
  readonly profilePic?: string | null;
  readonly address?: string | null;
  readonly landMark?: string | null;
  readonly phoneNumber?: string | null;
  readonly email?: string | null;
  readonly courierNIN?: string | null;
  readonly courierNINImage?: string | null;
  readonly bankCode?: string | null;
  readonly bankName?: string | null;
  readonly accountName?: string | null;
  readonly accountNumber?: string | null;
  readonly transportationType?: string | null;
  readonly vehicleClass?: string | null;
  readonly model?: string | null;
  readonly vehicleColour?: string | null;
  readonly plateNumber?: string | null;
  readonly maxiImages?: (string | null)[] | null;
  readonly maxiDescription?: string | null;
  readonly guarantorName?: string | null;
  readonly guarantorLastName?: string | null;
  readonly guarantorProfession?: string | null;
  readonly guarantorNumber?: string | null;
  readonly guarantorRelationship?: string | null;
  readonly guarantorAddress?: string | null;
  readonly guarantorEmail?: string | null;
  readonly guarantorNIN?: string | null;
  readonly guarantorNINImage?: string | null;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly heading?: number | null;
  readonly push_token?: string | null;
  readonly isApproved?: boolean | null;
  readonly approvedById?: string | null;
  readonly currentBatchCount?: number | null;
  readonly currentExpressCount?: number | null;
  readonly lastBatchAssignedAt?: string | null;
  readonly statusKey?: string | null;
  readonly offers: AsyncCollection<Offer>;
  readonly orders: AsyncCollection<Order>;
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
  readonly email?: string | null;
  readonly phoneNumber?: string | null;
  readonly profilePic?: string | null;
  readonly address?: string | null;
  readonly exactAddress?: string | null;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly push_token?: string | null;
  readonly Orders?: (Order | null)[] | null;
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
  readonly email?: string | null;
  readonly phoneNumber?: string | null;
  readonly profilePic?: string | null;
  readonly address?: string | null;
  readonly exactAddress?: string | null;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly push_token?: string | null;
  readonly Orders: AsyncCollection<Order>;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type User = LazyLoading extends LazyLoadingDisabled ? EagerUser : LazyUser

export declare const User: (new (init: ModelInit<User>) => User) & {
  copyOf(source: User, mutator: (draft: MutableModel<User>) => MutableModel<User> | void): User;
}