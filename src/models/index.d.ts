import { ModelInit, MutableModel, __modelMeta__, ManagedIdentifier } from "@aws-amplify/datastore";
// @ts-ignore
import { LazyLoading, LazyLoadingDisabled, AsyncItem, AsyncCollection } from "@aws-amplify/datastore";

export enum FleetOrganisationType {
  CORPORATE = "CORPORATE",
  REGISTERED_BUSINESS = "REGISTERED_BUSINESS",
  INFORMAL_FLEET = "INFORMAL_FLEET"
}

export enum FleetLegalStatus {
  REGISTERED = "REGISTERED",
  UNREGISTERED = "UNREGISTERED",
  REGISTRATION_IN_PROGRESS = "REGISTRATION_IN_PROGRESS"
}

export enum FleetVerificationStatus {
  UNVERIFIED = "UNVERIFIED",
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED"
}

export enum FleetStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  DEACTIVATED = "DEACTIVATED"
}

export enum FleetRole {
  OWNER = "OWNER",
  MANAGER = "MANAGER",
  DISPATCHER = "DISPATCHER",
  ACCOUNTANT = "ACCOUNTANT",
  RIDER = "RIDER"
}

export enum FleetMemberStatus {
  INVITED = "INVITED",
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  REMOVED = "REMOVED"
}

export enum FleetInvitationStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  DECLINED = "DECLINED",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED"
}

export enum FleetVehicleStatus {
  AVAILABLE = "AVAILABLE",
  ASSIGNED = "ASSIGNED",
  IN_USE = "IN_USE",
  MAINTENANCE = "MAINTENANCE",
  INACTIVE = "INACTIVE"
}

export enum FleetAssignmentType {
  MARKETPLACE_AUTO = "MARKETPLACE_AUTO",
  FLEET_DISPATCH = "FLEET_DISPATCH",
  PRIVATE = "PRIVATE"
}

export enum FleetOrderSource {
  ATUA_MARKETPLACE = "ATUA_MARKETPLACE",
  FLEET_CREATED = "FLEET_CREATED",
  API = "API"
}

export enum FleetSubscriptionPlan {
  FREE = "FREE",
  STARTER = "STARTER",
  GROWTH = "GROWTH",
  BUSINESS = "BUSINESS",
  ENTERPRISE = "ENTERPRISE"
}

export enum FleetSubscriptionStatus {
  ACTIVE = "ACTIVE",
  TRIALING = "TRIALING",
  PAST_DUE = "PAST_DUE",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED"
}

export enum CourierAvailabilityStatus {
  OFFLINE = "OFFLINE",
  AVAILABLE = "AVAILABLE",
  BUSY = "BUSY",
  ON_DELIVERY = "ON_DELIVERY",
  SUSPENDED = "SUSPENDED"
}

export enum PaystackEnvironment {
  TEST = "TEST",
  LIVE = "LIVE"
}

export enum OrderEnvironment {
  PRODUCTION = "PRODUCTION",
  TEST = "TEST"
}

export enum PaymentMethodStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  EXPIRED = "EXPIRED",
  FAILED = "FAILED"
}

export enum EarningsAllocationStatus {
  NOT_ALLOCATED = "NOT_ALLOCATED",
  PROCESSING = "PROCESSING",
  ALLOCATED = "ALLOCATED",
  FAILED = "FAILED"
}

export enum FundsStatus {
  HELD = "HELD",
  PARTIALLY_RELEASED = "PARTIALLY_RELEASED",
  RELEASED = "RELEASED"
}

export enum OrderPayoutStatus {
  NOT_PAID = "NOT_PAID",
  PAID = "PAID"
}

export enum OrderPaymentStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  PAID = "PAID",
  FAILED = "FAILED"
}

export enum PaymentStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED"
}

export enum TransactionType {
  CREDIT = "CREDIT",
  DEBIT = "DEBIT"
}

export enum TransactionStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REVERSED = "REVERSED"
}

export enum PayoutStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  PAID = "PAID",
  FAILED = "FAILED"
}

export enum PayoutSource {
  COURIER_REQUESTED = "COURIER_REQUESTED",
  ADMIN_MANUAL = "ADMIN_MANUAL",
  SYSTEM = "SYSTEM"
}

export enum OwnerType {
  COURIER = "COURIER",
  USER = "USER"
}

export enum OfferStatus {
  ACTIVE = "ACTIVE",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED"
}

export enum CourierPreTransferUploadStatus {
  PENDING = "PENDING",
  UPLOADING = "UPLOADING",
  COMPLETE = "COMPLETE",
  FAILED = "FAILED"
}

export enum CourierPostLoadingUploadStatus {
  PENDING = "PENDING",
  UPLOADING = "UPLOADING",
  COMPLETE = "COMPLETE",
  FAILED = "FAILED"
}

export enum DropoffUploadStatus {
  PENDING = "PENDING",
  UPLOADING = "UPLOADING",
  COMPLETE = "COMPLETE",
  FAILED = "FAILED"
}

export enum MediaUploadStatus {
  PENDING = "PENDING",
  UPLOADING = "UPLOADING",
  COMPLETE = "COMPLETE",
  FAILED = "FAILED"
}

export enum RefundStatus {
  NONE = "NONE",
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  NEEDS_ATTENTION = "NEEDS_ATTENTION",
  PROCESSED = "PROCESSED",
  FAILED = "FAILED"
}

export enum CancellationStage {
  BEFORE_ACCEPTANCE = "BEFORE_ACCEPTANCE",
  ACCEPTED = "ACCEPTED",
  COURIER_ARRIVED = "COURIER_ARRIVED",
  PICKUP_STARTED = "PICKUP_STARTED",
  PICKED_UP = "PICKED_UP",
  IN_TRANSIT = "IN_TRANSIT",
  DELIVERED = "DELIVERED"
}

export enum CancellationReason {
  CHANGED_MIND = "CHANGED_MIND",
  WRONG_ADDRESS = "WRONG_ADDRESS",
  WRONG_ORDER = "WRONG_ORDER",
  TOO_EXPENSIVE = "TOO_EXPENSIVE",
  TOO_LONG_TO_WAIT = "TOO_LONG_TO_WAIT",
  NO_LONGER_NEEDED = "NO_LONGER_NEEDED",
  COURIER_DELAY = "COURIER_DELAY",
  COURIER_REQUEST = "COURIER_REQUEST",
  SYSTEM_ERROR = "SYSTEM_ERROR",
  OTHER = "OTHER"
}

export enum CancellationStatus {
  NONE = "NONE",
  REQUESTED = "REQUESTED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REJECTED = "REJECTED"
}

export enum OrderStatus {
  BIDDING = "BIDDING",
  AWAITING_PAYMENT = "AWAITING_PAYMENT",
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

export enum CourierReportStatus {
  OPEN = "OPEN",
  UNDER_REVIEW = "UNDER_REVIEW",
  RESOLVED = "RESOLVED",
  DISMISSED = "DISMISSED"
}

type EagerVerifyAtuaPaymentResult = {
  readonly success: boolean;
  readonly verified?: boolean | null;
  readonly alreadyPaid?: boolean | null;
  readonly message: string;
  readonly orderId?: string | null;
  readonly deliveryVerificationCode?: string | null;
  readonly payment?: VerifiedPaymentDetails | null;
}

type LazyVerifyAtuaPaymentResult = {
  readonly success: boolean;
  readonly verified?: boolean | null;
  readonly alreadyPaid?: boolean | null;
  readonly message: string;
  readonly orderId?: string | null;
  readonly deliveryVerificationCode?: string | null;
  readonly payment?: VerifiedPaymentDetails | null;
}

export declare type VerifyAtuaPaymentResult = LazyLoading extends LazyLoadingDisabled ? EagerVerifyAtuaPaymentResult : LazyVerifyAtuaPaymentResult

export declare const VerifyAtuaPaymentResult: (new (init: ModelInit<VerifyAtuaPaymentResult>) => VerifyAtuaPaymentResult)

type EagerVerifiedPaymentDetails = {
  readonly reference?: string | null;
  readonly amount?: number | null;
  readonly currency?: string | null;
  readonly status?: string | null;
  readonly channel?: string | null;
  readonly paidAt?: string | null;
}

type LazyVerifiedPaymentDetails = {
  readonly reference?: string | null;
  readonly amount?: number | null;
  readonly currency?: string | null;
  readonly status?: string | null;
  readonly channel?: string | null;
  readonly paidAt?: string | null;
}

export declare type VerifiedPaymentDetails = LazyLoading extends LazyLoadingDisabled ? EagerVerifiedPaymentDetails : LazyVerifiedPaymentDetails

export declare const VerifiedPaymentDetails: (new (init: ModelInit<VerifiedPaymentDetails>) => VerifiedPaymentDetails)

type EagerChargeAtuaPaymentMethodResult = {
  readonly success: boolean;
  readonly message: string;
  readonly reference?: string | null;
  readonly orderId?: string | null;
}

type LazyChargeAtuaPaymentMethodResult = {
  readonly success: boolean;
  readonly message: string;
  readonly reference?: string | null;
  readonly orderId?: string | null;
}

export declare type ChargeAtuaPaymentMethodResult = LazyLoading extends LazyLoadingDisabled ? EagerChargeAtuaPaymentMethodResult : LazyChargeAtuaPaymentMethodResult

export declare const ChargeAtuaPaymentMethodResult: (new (init: ModelInit<ChargeAtuaPaymentMethodResult>) => ChargeAtuaPaymentMethodResult)

type EagerDeleteSavedPaymentMethodResult = {
  readonly success: boolean;
  readonly message: string;
  readonly paymentMethodId?: string | null;
}

type LazyDeleteSavedPaymentMethodResult = {
  readonly success: boolean;
  readonly message: string;
  readonly paymentMethodId?: string | null;
}

export declare type DeleteSavedPaymentMethodResult = LazyLoading extends LazyLoadingDisabled ? EagerDeleteSavedPaymentMethodResult : LazyDeleteSavedPaymentMethodResult

export declare const DeleteSavedPaymentMethodResult: (new (init: ModelInit<DeleteSavedPaymentMethodResult>) => DeleteSavedPaymentMethodResult)

type EagerProcessPayoutsResponse = {
  readonly statusCode: number;
  readonly body: string;
}

type LazyProcessPayoutsResponse = {
  readonly statusCode: number;
  readonly body: string;
}

export declare type ProcessPayoutsResponse = LazyLoading extends LazyLoadingDisabled ? EagerProcessPayoutsResponse : LazyProcessPayoutsResponse

export declare const ProcessPayoutsResponse: (new (init: ModelInit<ProcessPayoutsResponse>) => ProcessPayoutsResponse)

type EagerReversePayoutResponse = {
  readonly success: boolean;
  readonly payoutID?: string | null;
  readonly transactionID?: string | null;
  readonly walletID?: string | null;
  readonly payoutStatus?: PayoutStatus | keyof typeof PayoutStatus | null;
  readonly transactionStatus?: TransactionStatus | keyof typeof TransactionStatus | null;
  readonly restoredAmount?: number | null;
  readonly alreadyReversed?: boolean | null;
  readonly message?: string | null;
}

type LazyReversePayoutResponse = {
  readonly success: boolean;
  readonly payoutID?: string | null;
  readonly transactionID?: string | null;
  readonly walletID?: string | null;
  readonly payoutStatus?: PayoutStatus | keyof typeof PayoutStatus | null;
  readonly transactionStatus?: TransactionStatus | keyof typeof TransactionStatus | null;
  readonly restoredAmount?: number | null;
  readonly alreadyReversed?: boolean | null;
  readonly message?: string | null;
}

export declare type ReversePayoutResponse = LazyLoading extends LazyLoadingDisabled ? EagerReversePayoutResponse : LazyReversePayoutResponse

export declare const ReversePayoutResponse: (new (init: ModelInit<ReversePayoutResponse>) => ReversePayoutResponse)

type EagerFleetWallet = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<FleetWallet, 'id'>;
  };
  readonly id: string;
  readonly fleetID: string;
  readonly availableBalance?: number | null;
  readonly pendingBalance?: number | null;
  readonly lifetimeEarnings?: number | null;
  readonly fleet?: Fleet | null;
  readonly transactions?: (FleetTransaction | null)[] | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyFleetWallet = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<FleetWallet, 'id'>;
  };
  readonly id: string;
  readonly fleetID: string;
  readonly availableBalance?: number | null;
  readonly pendingBalance?: number | null;
  readonly lifetimeEarnings?: number | null;
  readonly fleet: AsyncItem<Fleet | undefined>;
  readonly transactions: AsyncCollection<FleetTransaction>;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type FleetWallet = LazyLoading extends LazyLoadingDisabled ? EagerFleetWallet : LazyFleetWallet

export declare const FleetWallet: (new (init: ModelInit<FleetWallet>) => FleetWallet) & {
  copyOf(source: FleetWallet, mutator: (draft: MutableModel<FleetWallet>) => MutableModel<FleetWallet> | void): FleetWallet;
}

type EagerFleetTransaction = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<FleetTransaction, 'id'>;
  };
  readonly id: string;
  readonly fleetWalletID: string;
  readonly fleetID: string;
  readonly orderID?: string | null;
  readonly type: TransactionType | keyof typeof TransactionType;
  readonly status: TransactionStatus | keyof typeof TransactionStatus;
  readonly amount: number;
  readonly description?: string | null;
  readonly reference?: string | null;
  readonly fleet?: Fleet | null;
  readonly fleetWallet?: FleetWallet | null;
  readonly order?: Order | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyFleetTransaction = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<FleetTransaction, 'id'>;
  };
  readonly id: string;
  readonly fleetWalletID: string;
  readonly fleetID: string;
  readonly orderID?: string | null;
  readonly type: TransactionType | keyof typeof TransactionType;
  readonly status: TransactionStatus | keyof typeof TransactionStatus;
  readonly amount: number;
  readonly description?: string | null;
  readonly reference?: string | null;
  readonly fleet: AsyncItem<Fleet | undefined>;
  readonly fleetWallet: AsyncItem<FleetWallet | undefined>;
  readonly order: AsyncItem<Order | undefined>;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type FleetTransaction = LazyLoading extends LazyLoadingDisabled ? EagerFleetTransaction : LazyFleetTransaction

export declare const FleetTransaction: (new (init: ModelInit<FleetTransaction>) => FleetTransaction) & {
  copyOf(source: FleetTransaction, mutator: (draft: MutableModel<FleetTransaction>) => MutableModel<FleetTransaction> | void): FleetTransaction;
}

type EagerFleetSubscription = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<FleetSubscription, 'id'>;
  };
  readonly id: string;
  readonly fleetID: string;
  readonly plan: FleetSubscriptionPlan | keyof typeof FleetSubscriptionPlan;
  readonly status: FleetSubscriptionStatus | keyof typeof FleetSubscriptionStatus;
  readonly billingInterval?: string | null;
  readonly amount?: number | null;
  readonly currency?: string | null;
  readonly provider?: string | null;
  readonly providerReference?: string | null;
  readonly startedAt?: string | null;
  readonly currentPeriodStart?: string | null;
  readonly currentPeriodEnd?: string | null;
  readonly cancelledAt?: string | null;
  readonly fleet?: Fleet | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyFleetSubscription = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<FleetSubscription, 'id'>;
  };
  readonly id: string;
  readonly fleetID: string;
  readonly plan: FleetSubscriptionPlan | keyof typeof FleetSubscriptionPlan;
  readonly status: FleetSubscriptionStatus | keyof typeof FleetSubscriptionStatus;
  readonly billingInterval?: string | null;
  readonly amount?: number | null;
  readonly currency?: string | null;
  readonly provider?: string | null;
  readonly providerReference?: string | null;
  readonly startedAt?: string | null;
  readonly currentPeriodStart?: string | null;
  readonly currentPeriodEnd?: string | null;
  readonly cancelledAt?: string | null;
  readonly fleet: AsyncItem<Fleet | undefined>;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type FleetSubscription = LazyLoading extends LazyLoadingDisabled ? EagerFleetSubscription : LazyFleetSubscription

export declare const FleetSubscription: (new (init: ModelInit<FleetSubscription>) => FleetSubscription) & {
  copyOf(source: FleetSubscription, mutator: (draft: MutableModel<FleetSubscription>) => MutableModel<FleetSubscription> | void): FleetSubscription;
}

type EagerFleetOrder = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<FleetOrder, 'id'>;
  };
  readonly id: string;
  readonly fleetID: string;
  readonly orderID: string;
  readonly courierID?: string | null;
  readonly vehicleID?: string | null;
  readonly source: FleetOrderSource | keyof typeof FleetOrderSource;
  readonly assignmentType: FleetAssignmentType | keyof typeof FleetAssignmentType;
  readonly assignedAt?: string | null;
  readonly completedAt?: string | null;
  readonly fleetEarnings?: number | null;
  readonly fleet?: Fleet | null;
  readonly order?: Order | null;
  readonly courier?: Courier | null;
  readonly vehicle?: FleetVehicle | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyFleetOrder = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<FleetOrder, 'id'>;
  };
  readonly id: string;
  readonly fleetID: string;
  readonly orderID: string;
  readonly courierID?: string | null;
  readonly vehicleID?: string | null;
  readonly source: FleetOrderSource | keyof typeof FleetOrderSource;
  readonly assignmentType: FleetAssignmentType | keyof typeof FleetAssignmentType;
  readonly assignedAt?: string | null;
  readonly completedAt?: string | null;
  readonly fleetEarnings?: number | null;
  readonly fleet: AsyncItem<Fleet | undefined>;
  readonly order: AsyncItem<Order | undefined>;
  readonly courier: AsyncItem<Courier | undefined>;
  readonly vehicle: AsyncItem<FleetVehicle | undefined>;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type FleetOrder = LazyLoading extends LazyLoadingDisabled ? EagerFleetOrder : LazyFleetOrder

export declare const FleetOrder: (new (init: ModelInit<FleetOrder>) => FleetOrder) & {
  copyOf(source: FleetOrder, mutator: (draft: MutableModel<FleetOrder>) => MutableModel<FleetOrder> | void): FleetOrder;
}

type EagerFleet = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Fleet, 'id'>;
  };
  readonly id: string;
  readonly name: string;
  readonly businessName?: string | null;
  readonly organisationType: FleetOrganisationType | keyof typeof FleetOrganisationType;
  readonly legalStatus: FleetLegalStatus | keyof typeof FleetLegalStatus;
  readonly verificationStatus: FleetVerificationStatus | keyof typeof FleetVerificationStatus;
  readonly registrationNumber?: string | null;
  readonly registrationCountry?: string | null;
  readonly registrationAuthority?: string | null;
  readonly isRecognisedBrand?: boolean | null;
  readonly brandWebsite?: string | null;
  readonly verificationNotes?: string | null;
  readonly logo?: string | null;
  readonly phoneNumber?: string | null;
  readonly email?: string | null;
  readonly address?: string | null;
  readonly state?: string | null;
  readonly city?: string | null;
  readonly landmark?: string | null;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly status: FleetStatus | keyof typeof FleetStatus;
  readonly ownerUserID: string;
  readonly subscriptionPlan?: FleetSubscriptionPlan | keyof typeof FleetSubscriptionPlan | null;
  readonly subscriptionStatus?: FleetSubscriptionStatus | keyof typeof FleetSubscriptionStatus | null;
  readonly subscriptionStartedAt?: string | null;
  readonly subscriptionRenewsAt?: string | null;
  readonly trialEndsAt?: string | null;
  readonly members?: (FleetMember | null)[] | null;
  readonly vehicles?: (FleetVehicle | null)[] | null;
  readonly invitations?: (FleetInvitation | null)[] | null;
  readonly fleetOrders?: (FleetOrder | null)[] | null;
  readonly walletID?: string | null;
  readonly wallets?: (FleetWallet | null)[] | null;
  readonly transactions?: (FleetTransaction | null)[] | null;
  readonly subscriptions?: (FleetSubscription | null)[] | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyFleet = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Fleet, 'id'>;
  };
  readonly id: string;
  readonly name: string;
  readonly businessName?: string | null;
  readonly organisationType: FleetOrganisationType | keyof typeof FleetOrganisationType;
  readonly legalStatus: FleetLegalStatus | keyof typeof FleetLegalStatus;
  readonly verificationStatus: FleetVerificationStatus | keyof typeof FleetVerificationStatus;
  readonly registrationNumber?: string | null;
  readonly registrationCountry?: string | null;
  readonly registrationAuthority?: string | null;
  readonly isRecognisedBrand?: boolean | null;
  readonly brandWebsite?: string | null;
  readonly verificationNotes?: string | null;
  readonly logo?: string | null;
  readonly phoneNumber?: string | null;
  readonly email?: string | null;
  readonly address?: string | null;
  readonly state?: string | null;
  readonly city?: string | null;
  readonly landmark?: string | null;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly status: FleetStatus | keyof typeof FleetStatus;
  readonly ownerUserID: string;
  readonly subscriptionPlan?: FleetSubscriptionPlan | keyof typeof FleetSubscriptionPlan | null;
  readonly subscriptionStatus?: FleetSubscriptionStatus | keyof typeof FleetSubscriptionStatus | null;
  readonly subscriptionStartedAt?: string | null;
  readonly subscriptionRenewsAt?: string | null;
  readonly trialEndsAt?: string | null;
  readonly members: AsyncCollection<FleetMember>;
  readonly vehicles: AsyncCollection<FleetVehicle>;
  readonly invitations: AsyncCollection<FleetInvitation>;
  readonly fleetOrders: AsyncCollection<FleetOrder>;
  readonly walletID?: string | null;
  readonly wallets: AsyncCollection<FleetWallet>;
  readonly transactions: AsyncCollection<FleetTransaction>;
  readonly subscriptions: AsyncCollection<FleetSubscription>;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type Fleet = LazyLoading extends LazyLoadingDisabled ? EagerFleet : LazyFleet

export declare const Fleet: (new (init: ModelInit<Fleet>) => Fleet) & {
  copyOf(source: Fleet, mutator: (draft: MutableModel<Fleet>) => MutableModel<Fleet> | void): Fleet;
}

type EagerFleetMember = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<FleetMember, 'id'>;
  };
  readonly id: string;
  readonly fleetID: string;
  readonly courierID: string;
  readonly role: FleetRole | keyof typeof FleetRole;
  readonly status: FleetMemberStatus | keyof typeof FleetMemberStatus;
  readonly currentVehicleID?: string | null;
  readonly invitedByID?: string | null;
  readonly approvedByID?: string | null;
  readonly joinedAt?: string | null;
  readonly leftAt?: string | null;
  readonly fleet?: Fleet | null;
  readonly courier?: Courier | null;
  readonly currentVehicle?: FleetVehicle | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyFleetMember = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<FleetMember, 'id'>;
  };
  readonly id: string;
  readonly fleetID: string;
  readonly courierID: string;
  readonly role: FleetRole | keyof typeof FleetRole;
  readonly status: FleetMemberStatus | keyof typeof FleetMemberStatus;
  readonly currentVehicleID?: string | null;
  readonly invitedByID?: string | null;
  readonly approvedByID?: string | null;
  readonly joinedAt?: string | null;
  readonly leftAt?: string | null;
  readonly fleet: AsyncItem<Fleet | undefined>;
  readonly courier: AsyncItem<Courier | undefined>;
  readonly currentVehicle: AsyncItem<FleetVehicle | undefined>;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type FleetMember = LazyLoading extends LazyLoadingDisabled ? EagerFleetMember : LazyFleetMember

export declare const FleetMember: (new (init: ModelInit<FleetMember>) => FleetMember) & {
  copyOf(source: FleetMember, mutator: (draft: MutableModel<FleetMember>) => MutableModel<FleetMember> | void): FleetMember;
}

type EagerFleetInvitation = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<FleetInvitation, 'id'>;
  };
  readonly id: string;
  readonly fleetID: string;
  readonly courierID?: string | null;
  readonly phoneNumber?: string | null;
  readonly email?: string | null;
  readonly role: FleetRole | keyof typeof FleetRole;
  readonly status: FleetInvitationStatus | keyof typeof FleetInvitationStatus;
  readonly invitationCode: string;
  readonly invitedByID: string;
  readonly expiresAt: string;
  readonly acceptedAt?: string | null;
  readonly fleet?: Fleet | null;
  readonly courier?: Courier | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyFleetInvitation = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<FleetInvitation, 'id'>;
  };
  readonly id: string;
  readonly fleetID: string;
  readonly courierID?: string | null;
  readonly phoneNumber?: string | null;
  readonly email?: string | null;
  readonly role: FleetRole | keyof typeof FleetRole;
  readonly status: FleetInvitationStatus | keyof typeof FleetInvitationStatus;
  readonly invitationCode: string;
  readonly invitedByID: string;
  readonly expiresAt: string;
  readonly acceptedAt?: string | null;
  readonly fleet: AsyncItem<Fleet | undefined>;
  readonly courier: AsyncItem<Courier | undefined>;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type FleetInvitation = LazyLoading extends LazyLoadingDisabled ? EagerFleetInvitation : LazyFleetInvitation

export declare const FleetInvitation: (new (init: ModelInit<FleetInvitation>) => FleetInvitation) & {
  copyOf(source: FleetInvitation, mutator: (draft: MutableModel<FleetInvitation>) => MutableModel<FleetInvitation> | void): FleetInvitation;
}

type EagerFleetVehicle = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<FleetVehicle, 'id'>;
  };
  readonly id: string;
  readonly fleetID: string;
  readonly vehicleType: string;
  readonly vehicleClass?: string | null;
  readonly make?: string | null;
  readonly model?: string | null;
  readonly year?: number | null;
  readonly plateNumber: string;
  readonly colour?: string | null;
  readonly status: FleetVehicleStatus | keyof typeof FleetVehicleStatus;
  readonly assignedCourierID?: string | null;
  readonly assignedAt?: string | null;
  readonly registrationDocument?: string | null;
  readonly insuranceDocument?: string | null;
  readonly fleet?: Fleet | null;
  readonly assignedCourier?: Courier | null;
  readonly assignedMembers?: (FleetMember | null)[] | null;
  readonly fleetOrders?: (FleetOrder | null)[] | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyFleetVehicle = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<FleetVehicle, 'id'>;
  };
  readonly id: string;
  readonly fleetID: string;
  readonly vehicleType: string;
  readonly vehicleClass?: string | null;
  readonly make?: string | null;
  readonly model?: string | null;
  readonly year?: number | null;
  readonly plateNumber: string;
  readonly colour?: string | null;
  readonly status: FleetVehicleStatus | keyof typeof FleetVehicleStatus;
  readonly assignedCourierID?: string | null;
  readonly assignedAt?: string | null;
  readonly registrationDocument?: string | null;
  readonly insuranceDocument?: string | null;
  readonly fleet: AsyncItem<Fleet | undefined>;
  readonly assignedCourier: AsyncItem<Courier | undefined>;
  readonly assignedMembers: AsyncCollection<FleetMember>;
  readonly fleetOrders: AsyncCollection<FleetOrder>;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type FleetVehicle = LazyLoading extends LazyLoadingDisabled ? EagerFleetVehicle : LazyFleetVehicle

export declare const FleetVehicle: (new (init: ModelInit<FleetVehicle>) => FleetVehicle) & {
  copyOf(source: FleetVehicle, mutator: (draft: MutableModel<FleetVehicle>) => MutableModel<FleetVehicle> | void): FleetVehicle;
}

type EagerPaymentMethod = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<PaymentMethod, 'id'>;
  };
  readonly id: string;
  readonly owner: string;
  readonly userID: string;
  readonly user?: User | null;
  readonly paystackEnvironment?: PaystackEnvironment | keyof typeof PaystackEnvironment | null;
  readonly provider: string;
  readonly authorizationCode: string;
  readonly signature: string;
  readonly cardType?: string | null;
  readonly last4?: string | null;
  readonly expMonth?: string | null;
  readonly expYear?: string | null;
  readonly bank?: string | null;
  readonly countryCode?: string | null;
  readonly channel?: string | null;
  readonly reusable: boolean;
  readonly email: string;
  readonly isDefault: boolean;
  readonly status: PaymentMethodStatus | keyof typeof PaymentMethodStatus;
  readonly deactivatedAt?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyPaymentMethod = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<PaymentMethod, 'id'>;
  };
  readonly id: string;
  readonly owner: string;
  readonly userID: string;
  readonly user: AsyncItem<User | undefined>;
  readonly paystackEnvironment?: PaystackEnvironment | keyof typeof PaystackEnvironment | null;
  readonly provider: string;
  readonly authorizationCode: string;
  readonly signature: string;
  readonly cardType?: string | null;
  readonly last4?: string | null;
  readonly expMonth?: string | null;
  readonly expYear?: string | null;
  readonly bank?: string | null;
  readonly countryCode?: string | null;
  readonly channel?: string | null;
  readonly reusable: boolean;
  readonly email: string;
  readonly isDefault: boolean;
  readonly status: PaymentMethodStatus | keyof typeof PaymentMethodStatus;
  readonly deactivatedAt?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type PaymentMethod = LazyLoading extends LazyLoadingDisabled ? EagerPaymentMethod : LazyPaymentMethod

export declare const PaymentMethod: (new (init: ModelInit<PaymentMethod>) => PaymentMethod) & {
  copyOf(source: PaymentMethod, mutator: (draft: MutableModel<PaymentMethod>) => MutableModel<PaymentMethod> | void): PaymentMethod;
}

type EagerPayout = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Payout, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly courierID: string;
  readonly walletID?: string | null;
  readonly amount: number;
  readonly payoutFee?: number | null;
  readonly totalWalletDebit?: number | null;
  readonly status?: PayoutStatus | keyof typeof PayoutStatus | null;
  readonly bankName?: string | null;
  readonly accountNumber?: string | null;
  readonly reference?: string | null;
  readonly transferCode?: string | null;
  readonly transferID?: string | null;
  readonly failureReason?: string | null;
  readonly payoutMethod?: string | null;
  readonly payoutSource?: PayoutSource | keyof typeof PayoutSource | null;
  readonly processedAt?: string | null;
  readonly paidAt?: string | null;
  readonly failedAt?: string | null;
  readonly walletRestoredAt?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyPayout = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Payout, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly courierID: string;
  readonly walletID?: string | null;
  readonly amount: number;
  readonly payoutFee?: number | null;
  readonly totalWalletDebit?: number | null;
  readonly status?: PayoutStatus | keyof typeof PayoutStatus | null;
  readonly bankName?: string | null;
  readonly accountNumber?: string | null;
  readonly reference?: string | null;
  readonly transferCode?: string | null;
  readonly transferID?: string | null;
  readonly failureReason?: string | null;
  readonly payoutMethod?: string | null;
  readonly payoutSource?: PayoutSource | keyof typeof PayoutSource | null;
  readonly processedAt?: string | null;
  readonly paidAt?: string | null;
  readonly failedAt?: string | null;
  readonly walletRestoredAt?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type Payout = LazyLoading extends LazyLoadingDisabled ? EagerPayout : LazyPayout

export declare const Payout: (new (init: ModelInit<Payout>) => Payout) & {
  copyOf(source: Payout, mutator: (draft: MutableModel<Payout>) => MutableModel<Payout> | void): Payout;
}

type EagerTransaction = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Transaction, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly walletID: string;
  readonly payoutID?: string | null;
  readonly type?: TransactionType | keyof typeof TransactionType | null;
  readonly amount: number;
  readonly description?: string | null;
  readonly orderID?: string | null;
  readonly paymentID?: string | null;
  readonly reference?: string | null;
  readonly status?: TransactionStatus | keyof typeof TransactionStatus | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyTransaction = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Transaction, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly walletID: string;
  readonly payoutID?: string | null;
  readonly type?: TransactionType | keyof typeof TransactionType | null;
  readonly amount: number;
  readonly description?: string | null;
  readonly orderID?: string | null;
  readonly paymentID?: string | null;
  readonly reference?: string | null;
  readonly status?: TransactionStatus | keyof typeof TransactionStatus | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type Transaction = LazyLoading extends LazyLoadingDisabled ? EagerTransaction : LazyTransaction

export declare const Transaction: (new (init: ModelInit<Transaction>) => Transaction) & {
  copyOf(source: Transaction, mutator: (draft: MutableModel<Transaction>) => MutableModel<Transaction> | void): Transaction;
}

type EagerWallet = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Wallet, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly ownerID: string;
  readonly ownerType: OwnerType | keyof typeof OwnerType;
  readonly availableBalance?: number | null;
  readonly pendingBalance?: number | null;
  readonly lifetimeEarnings?: number | null;
  readonly transactions?: (Transaction | null)[] | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyWallet = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Wallet, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly ownerID: string;
  readonly ownerType: OwnerType | keyof typeof OwnerType;
  readonly availableBalance?: number | null;
  readonly pendingBalance?: number | null;
  readonly lifetimeEarnings?: number | null;
  readonly transactions: AsyncCollection<Transaction>;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type Wallet = LazyLoading extends LazyLoadingDisabled ? EagerWallet : LazyWallet

export declare const Wallet: (new (init: ModelInit<Wallet>) => Wallet) & {
  copyOf(source: Wallet, mutator: (draft: MutableModel<Wallet>) => MutableModel<Wallet> | void): Wallet;
}

type EagerPayment = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Payment, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly orderID: string;
  readonly userID: string;
  readonly amount: number;
  readonly currency?: string | null;
  readonly status?: PaymentStatus | keyof typeof PaymentStatus | null;
  readonly paymentMethod?: string | null;
  readonly provider?: string | null;
  readonly reference?: string | null;
  readonly order?: Order | null;
  readonly user?: User | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyPayment = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Payment, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly orderID: string;
  readonly userID: string;
  readonly amount: number;
  readonly currency?: string | null;
  readonly status?: PaymentStatus | keyof typeof PaymentStatus | null;
  readonly paymentMethod?: string | null;
  readonly provider?: string | null;
  readonly reference?: string | null;
  readonly order: AsyncItem<Order | undefined>;
  readonly user: AsyncItem<User | undefined>;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type Payment = LazyLoading extends LazyLoadingDisabled ? EagerPayment : LazyPayment

export declare const Payment: (new (init: ModelInit<Payment>) => Payment) & {
  copyOf(source: Payment, mutator: (draft: MutableModel<Payment>) => MutableModel<Payment> | void): Payment;
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

type EagerOrderCancellation = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<OrderCancellation, 'id'>;
  };
  readonly id: string;
  readonly orderID: string;
  readonly userID: string;
  readonly courierID?: string | null;
  readonly status: CancellationStatus | keyof typeof CancellationStatus;
  readonly stage: CancellationStage | keyof typeof CancellationStage;
  readonly reason?: CancellationReason | keyof typeof CancellationReason | null;
  readonly reasonNote?: string | null;
  readonly originalAmount: number;
  readonly cancellationFee: number;
  readonly refundAmount: number;
  readonly refundStatus: RefundStatus | keyof typeof RefundStatus;
  readonly refundReference?: string | null;
  readonly paymentReference?: string | null;
  readonly cancellationRequestedAt: string;
  readonly cancellationProcessedAt?: string | null;
  readonly refundRequestedAt?: string | null;
  readonly refundedAt?: string | null;
  readonly courierReversed: boolean;
  readonly courierEarningsReversed: boolean;
  readonly walletReversed: boolean;
  readonly assignmentReversed: boolean;
  readonly errorMessage?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyOrderCancellation = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<OrderCancellation, 'id'>;
  };
  readonly id: string;
  readonly orderID: string;
  readonly userID: string;
  readonly courierID?: string | null;
  readonly status: CancellationStatus | keyof typeof CancellationStatus;
  readonly stage: CancellationStage | keyof typeof CancellationStage;
  readonly reason?: CancellationReason | keyof typeof CancellationReason | null;
  readonly reasonNote?: string | null;
  readonly originalAmount: number;
  readonly cancellationFee: number;
  readonly refundAmount: number;
  readonly refundStatus: RefundStatus | keyof typeof RefundStatus;
  readonly refundReference?: string | null;
  readonly paymentReference?: string | null;
  readonly cancellationRequestedAt: string;
  readonly cancellationProcessedAt?: string | null;
  readonly refundRequestedAt?: string | null;
  readonly refundedAt?: string | null;
  readonly courierReversed: boolean;
  readonly courierEarningsReversed: boolean;
  readonly walletReversed: boolean;
  readonly assignmentReversed: boolean;
  readonly errorMessage?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type OrderCancellation = LazyLoading extends LazyLoadingDisabled ? EagerOrderCancellation : LazyOrderCancellation

export declare const OrderCancellation: (new (init: ModelInit<OrderCancellation>) => OrderCancellation) & {
  copyOf(source: OrderCancellation, mutator: (draft: MutableModel<OrderCancellation>) => MutableModel<OrderCancellation> | void): OrderCancellation;
}

type EagerOrder = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Order, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly senderName?: string | null;
  readonly senderNumber?: string | null;
  readonly senderNumber2?: string | null;
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
  readonly cancellationStatus?: CancellationStatus | keyof typeof CancellationStatus | null;
  readonly refundStatus?: RefundStatus | keyof typeof RefundStatus | null;
  readonly cancellationFee?: number | null;
  readonly refundAmount?: number | null;
  readonly cancellationReason?: CancellationReason | keyof typeof CancellationReason | null;
  readonly cancellationReasonNote?: string | null;
  readonly cancellationStage?: CancellationStage | keyof typeof CancellationStage | null;
  readonly cancellationRequestedAt?: string | null;
  readonly cancellationProcessedAt?: string | null;
  readonly refundReference?: string | null;
  readonly refundRequestedAt?: string | null;
  readonly refundedAt?: string | null;
  readonly hasNewOffer?: boolean | null;
  readonly lastOfferAt?: string | null;
  readonly lastOfferSenderType?: string | null;
  readonly loadCategory?: string | null;
  readonly isInterState?: boolean | null;
  readonly estimatedMinPrice?: number | null;
  readonly estimatedMaxPrice?: number | null;
  readonly initialOfferPrice?: number | null;
  readonly loadingFee?: number | null;
  readonly unloadingFee?: number | null;
  readonly floorSurcharge?: number | null;
  readonly fragileSurcharge?: number | null;
  readonly extrasTotal?: number | null;
  readonly totalPrice?: number | null;
  readonly operationalFare?: number | null;
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
  readonly courierPreTransferUploadStatus?: CourierPreTransferUploadStatus | keyof typeof CourierPreTransferUploadStatus | null;
  readonly courierPostLoadingUploadStatus?: CourierPostLoadingUploadStatus | keyof typeof CourierPostLoadingUploadStatus | null;
  readonly dropoffUploadStatus?: DropoffUploadStatus | keyof typeof DropoffUploadStatus | null;
  readonly courierPreTransferPhotos?: (string | null)[] | null;
  readonly courierPreTransferVideo?: string | null;
  readonly courierPreTransferRecordedAt?: string | null;
  readonly courierPreTransferLocalPhotos?: (string | null)[] | null;
  readonly courierPreTransferLocalVideo?: string | null;
  readonly courierPostLoadingPhotos?: (string | null)[] | null;
  readonly courierPostLoadingVideo?: string | null;
  readonly courierPostLoadingLocalPhotos?: (string | null)[] | null;
  readonly courierPostLoadingLocalVideo?: string | null;
  readonly dropoffArrivalPhotos?: (string | null)[] | null;
  readonly dropoffArrivalVideo?: string | null;
  readonly dropoffArrivalLocalPhotos?: (string | null)[] | null;
  readonly dropoffArrivalLocalVideo?: string | null;
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
  readonly paymentStatus?: OrderPaymentStatus | keyof typeof OrderPaymentStatus | null;
  readonly paymentID?: string | null;
  readonly paymentReference?: string | null;
  readonly payoutStatus?: OrderPayoutStatus | keyof typeof OrderPayoutStatus | null;
  readonly fundsStatus?: FundsStatus | keyof typeof FundsStatus | null;
  readonly earningsAllocationStatus?: EarningsAllocationStatus | keyof typeof EarningsAllocationStatus | null;
  readonly earningsAllocatedAt?: string | null;
  readonly maxiCountIncrementedAt?: string | null;
  readonly fundsReleaseBlocked?: boolean | null;
  readonly fundsHoldReason?: string | null;
  readonly fundsHeldBy?: string | null;
  readonly fundsHeldAt?: string | null;
  readonly fundsReleasedAmount?: number | null;
  readonly pickupFundsReleasedAt?: string | null;
  readonly fundsReleasedAt?: string | null;
  readonly fundsReleaseType?: string | null;
  readonly orderEnvironment?: OrderEnvironment | keyof typeof OrderEnvironment | null;
  readonly assignedCourierId?: string | null;
  readonly assignmentExpiresAt?: string | null;
  readonly assignmentAttempts?: number | null;
  readonly lastAssignedAt?: string | null;
  readonly rejectedCourierIds?: (string | null)[] | null;
  readonly assignmentStatus?: string | null;
  readonly trackingStartedAt?: string | null;
  readonly trackingEndedAt?: string | null;
  readonly recipientTrackingToken?: string | null;
  readonly recipientTrackingEnabled?: boolean | null;
  readonly recipientTrackingRevokedAt?: string | null;
  readonly userID: string;
  readonly reviews?: (CourierReview | null)[] | null;
  readonly reports?: (CourierReport | null)[] | null;
  readonly offers?: (Offer | null)[] | null;
  readonly assignedCourier?: Courier | null;
  readonly fleetOrders?: (FleetOrder | null)[] | null;
  readonly fleetTransactions?: (FleetTransaction | null)[] | null;
  readonly payments?: (Payment | null)[] | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyOrder = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Order, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly senderName?: string | null;
  readonly senderNumber?: string | null;
  readonly senderNumber2?: string | null;
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
  readonly cancellationStatus?: CancellationStatus | keyof typeof CancellationStatus | null;
  readonly refundStatus?: RefundStatus | keyof typeof RefundStatus | null;
  readonly cancellationFee?: number | null;
  readonly refundAmount?: number | null;
  readonly cancellationReason?: CancellationReason | keyof typeof CancellationReason | null;
  readonly cancellationReasonNote?: string | null;
  readonly cancellationStage?: CancellationStage | keyof typeof CancellationStage | null;
  readonly cancellationRequestedAt?: string | null;
  readonly cancellationProcessedAt?: string | null;
  readonly refundReference?: string | null;
  readonly refundRequestedAt?: string | null;
  readonly refundedAt?: string | null;
  readonly hasNewOffer?: boolean | null;
  readonly lastOfferAt?: string | null;
  readonly lastOfferSenderType?: string | null;
  readonly loadCategory?: string | null;
  readonly isInterState?: boolean | null;
  readonly estimatedMinPrice?: number | null;
  readonly estimatedMaxPrice?: number | null;
  readonly initialOfferPrice?: number | null;
  readonly loadingFee?: number | null;
  readonly unloadingFee?: number | null;
  readonly floorSurcharge?: number | null;
  readonly fragileSurcharge?: number | null;
  readonly extrasTotal?: number | null;
  readonly totalPrice?: number | null;
  readonly operationalFare?: number | null;
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
  readonly courierPreTransferUploadStatus?: CourierPreTransferUploadStatus | keyof typeof CourierPreTransferUploadStatus | null;
  readonly courierPostLoadingUploadStatus?: CourierPostLoadingUploadStatus | keyof typeof CourierPostLoadingUploadStatus | null;
  readonly dropoffUploadStatus?: DropoffUploadStatus | keyof typeof DropoffUploadStatus | null;
  readonly courierPreTransferPhotos?: (string | null)[] | null;
  readonly courierPreTransferVideo?: string | null;
  readonly courierPreTransferRecordedAt?: string | null;
  readonly courierPreTransferLocalPhotos?: (string | null)[] | null;
  readonly courierPreTransferLocalVideo?: string | null;
  readonly courierPostLoadingPhotos?: (string | null)[] | null;
  readonly courierPostLoadingVideo?: string | null;
  readonly courierPostLoadingLocalPhotos?: (string | null)[] | null;
  readonly courierPostLoadingLocalVideo?: string | null;
  readonly dropoffArrivalPhotos?: (string | null)[] | null;
  readonly dropoffArrivalVideo?: string | null;
  readonly dropoffArrivalLocalPhotos?: (string | null)[] | null;
  readonly dropoffArrivalLocalVideo?: string | null;
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
  readonly paymentStatus?: OrderPaymentStatus | keyof typeof OrderPaymentStatus | null;
  readonly paymentID?: string | null;
  readonly paymentReference?: string | null;
  readonly payoutStatus?: OrderPayoutStatus | keyof typeof OrderPayoutStatus | null;
  readonly fundsStatus?: FundsStatus | keyof typeof FundsStatus | null;
  readonly earningsAllocationStatus?: EarningsAllocationStatus | keyof typeof EarningsAllocationStatus | null;
  readonly earningsAllocatedAt?: string | null;
  readonly maxiCountIncrementedAt?: string | null;
  readonly fundsReleaseBlocked?: boolean | null;
  readonly fundsHoldReason?: string | null;
  readonly fundsHeldBy?: string | null;
  readonly fundsHeldAt?: string | null;
  readonly fundsReleasedAmount?: number | null;
  readonly pickupFundsReleasedAt?: string | null;
  readonly fundsReleasedAt?: string | null;
  readonly fundsReleaseType?: string | null;
  readonly orderEnvironment?: OrderEnvironment | keyof typeof OrderEnvironment | null;
  readonly assignedCourierId?: string | null;
  readonly assignmentExpiresAt?: string | null;
  readonly assignmentAttempts?: number | null;
  readonly lastAssignedAt?: string | null;
  readonly rejectedCourierIds?: (string | null)[] | null;
  readonly assignmentStatus?: string | null;
  readonly trackingStartedAt?: string | null;
  readonly trackingEndedAt?: string | null;
  readonly recipientTrackingToken?: string | null;
  readonly recipientTrackingEnabled?: boolean | null;
  readonly recipientTrackingRevokedAt?: string | null;
  readonly userID: string;
  readonly reviews: AsyncCollection<CourierReview>;
  readonly reports: AsyncCollection<CourierReport>;
  readonly offers: AsyncCollection<Offer>;
  readonly assignedCourier: AsyncItem<Courier | undefined>;
  readonly fleetOrders: AsyncCollection<FleetOrder>;
  readonly fleetTransactions: AsyncCollection<FleetTransaction>;
  readonly payments: AsyncCollection<Payment>;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type Order = LazyLoading extends LazyLoadingDisabled ? EagerOrder : LazyOrder

export declare const Order: (new (init: ModelInit<Order>) => Order) & {
  copyOf(source: Order, mutator: (draft: MutableModel<Order>) => MutableModel<Order> | void): Order;
}

type EagerCourierReport = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<CourierReport, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly courierID: string;
  readonly courier?: Courier | null;
  readonly userID: string;
  readonly user?: User | null;
  readonly orderID: string;
  readonly order?: Order | null;
  readonly reason: string;
  readonly description?: string | null;
  readonly evidencePhotos?: (string | null)[] | null;
  readonly evidenceVideo?: string | null;
  readonly status?: CourierReportStatus | keyof typeof CourierReportStatus | null;
  readonly adminComment?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyCourierReport = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<CourierReport, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly courierID: string;
  readonly courier: AsyncItem<Courier | undefined>;
  readonly userID: string;
  readonly user: AsyncItem<User | undefined>;
  readonly orderID: string;
  readonly order: AsyncItem<Order | undefined>;
  readonly reason: string;
  readonly description?: string | null;
  readonly evidencePhotos?: (string | null)[] | null;
  readonly evidenceVideo?: string | null;
  readonly status?: CourierReportStatus | keyof typeof CourierReportStatus | null;
  readonly adminComment?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type CourierReport = LazyLoading extends LazyLoadingDisabled ? EagerCourierReport : LazyCourierReport

export declare const CourierReport: (new (init: ModelInit<CourierReport>) => CourierReport) & {
  copyOf(source: CourierReport, mutator: (draft: MutableModel<CourierReport>) => MutableModel<CourierReport> | void): CourierReport;
}

type EagerCourierReview = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<CourierReview, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly courierID: string;
  readonly courier?: Courier | null;
  readonly userID: string;
  readonly user?: User | null;
  readonly orderID: string;
  readonly order?: Order | null;
  readonly rating: number;
  readonly comment?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyCourierReview = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<CourierReview, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly courierID: string;
  readonly courier: AsyncItem<Courier | undefined>;
  readonly userID: string;
  readonly user: AsyncItem<User | undefined>;
  readonly orderID: string;
  readonly order: AsyncItem<Order | undefined>;
  readonly rating: number;
  readonly comment?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type CourierReview = LazyLoading extends LazyLoadingDisabled ? EagerCourierReview : LazyCourierReview

export declare const CourierReview: (new (init: ModelInit<CourierReview>) => CourierReview) & {
  copyOf(source: CourierReview, mutator: (draft: MutableModel<CourierReview>) => MutableModel<CourierReview> | void): CourierReview;
}

type EagerAdminAlert = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<AdminAlert, 'id'>;
    readOnlyFields: 'updatedAt';
  };
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly message: string;
  readonly severity: string;
  readonly status: string;
  readonly payoutID?: string | null;
  readonly payoutMethod?: string | null;
  readonly payoutSource?: PayoutSource | keyof typeof PayoutSource | null;
  readonly courierID?: string | null;
  readonly amount?: number | null;
  readonly courierObligations?: number | null;
  readonly paystackCosts?: number | null;
  readonly totalRequired?: number | null;
  readonly paystackBalance?: number | null;
  readonly topUpRequired?: number | null;
  readonly affectedCourierCount?: number | null;
  readonly createdAt: string;
  readonly readAt?: string | null;
  readonly resolvedAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyAdminAlert = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<AdminAlert, 'id'>;
    readOnlyFields: 'updatedAt';
  };
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly message: string;
  readonly severity: string;
  readonly status: string;
  readonly payoutID?: string | null;
  readonly payoutMethod?: string | null;
  readonly payoutSource?: PayoutSource | keyof typeof PayoutSource | null;
  readonly courierID?: string | null;
  readonly amount?: number | null;
  readonly courierObligations?: number | null;
  readonly paystackCosts?: number | null;
  readonly totalRequired?: number | null;
  readonly paystackBalance?: number | null;
  readonly topUpRequired?: number | null;
  readonly affectedCourierCount?: number | null;
  readonly createdAt: string;
  readonly readAt?: string | null;
  readonly resolvedAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type AdminAlert = LazyLoading extends LazyLoadingDisabled ? EagerAdminAlert : LazyAdminAlert

export declare const AdminAlert: (new (init: ModelInit<AdminAlert>) => AdminAlert) & {
  copyOf(source: AdminAlert, mutator: (draft: MutableModel<AdminAlert>) => MutableModel<AdminAlert> | void): AdminAlert;
}

type EagerCourierLiveLocation = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<CourierLiveLocation, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly courierID: string;
  readonly courier?: Courier | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly heading?: number | null;
  readonly speed?: number | null;
  readonly accuracy?: number | null;
  readonly altitude?: number | null;
  readonly isTracking?: boolean | null;
  readonly trackingSource?: string | null;
  readonly lastSeenAt: string;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

type LazyCourierLiveLocation = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<CourierLiveLocation, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly courierID: string;
  readonly courier: AsyncItem<Courier | undefined>;
  readonly latitude: number;
  readonly longitude: number;
  readonly heading?: number | null;
  readonly speed?: number | null;
  readonly accuracy?: number | null;
  readonly altitude?: number | null;
  readonly isTracking?: boolean | null;
  readonly trackingSource?: string | null;
  readonly lastSeenAt: string;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type CourierLiveLocation = LazyLoading extends LazyLoadingDisabled ? EagerCourierLiveLocation : LazyCourierLiveLocation

export declare const CourierLiveLocation: (new (init: ModelInit<CourierLiveLocation>) => CourierLiveLocation) & {
  copyOf(source: CourierLiveLocation, mutator: (draft: MutableModel<CourierLiveLocation>) => MutableModel<CourierLiveLocation> | void): CourierLiveLocation;
}

type EagerCourier = {
  readonly [__modelMeta__]: {
    identifier: ManagedIdentifier<Courier, 'id'>;
    readOnlyFields: 'createdAt' | 'updatedAt';
  };
  readonly id: string;
  readonly sub: string;
  readonly isOnline?: boolean | null;
  readonly isBlocked?: boolean | null;
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
  readonly liveLocationID?: string | null;
  readonly liveLocation?: CourierLiveLocation | null;
  readonly isOnboardingComplete?: boolean | null;
  readonly push_token?: string | null;
  readonly isApproved?: boolean | null;
  readonly approvedById?: string | null;
  readonly currentBatchCount?: number | null;
  readonly currentExpressCount?: number | null;
  readonly currentMaxiCount?: number | null;
  readonly lastBatchAssignedAt?: string | null;
  readonly averageRating?: number | null;
  readonly reviewCount?: number | null;
  readonly totalReports?: number | null;
  readonly availabilityStatus?: CourierAvailabilityStatus | keyof typeof CourierAvailabilityStatus | null;
  readonly lastLocationUpdateAt?: string | null;
  readonly fleetMemberships?: (FleetMember | null)[] | null;
  readonly fleetVehicles?: (FleetVehicle | null)[] | null;
  readonly fleetOrders?: (FleetOrder | null)[] | null;
  readonly fleetInvitations?: (FleetInvitation | null)[] | null;
  readonly reviews?: (CourierReview | null)[] | null;
  readonly reports?: (CourierReport | null)[] | null;
  readonly statusKey?: string | null;
  readonly offers?: (Offer | null)[] | null;
  readonly orders?: (Order | null)[] | null;
  readonly walletID?: string | null;
  readonly wallet?: Wallet | null;
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
  readonly isBlocked?: boolean | null;
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
  readonly liveLocationID?: string | null;
  readonly liveLocation: AsyncItem<CourierLiveLocation | undefined>;
  readonly isOnboardingComplete?: boolean | null;
  readonly push_token?: string | null;
  readonly isApproved?: boolean | null;
  readonly approvedById?: string | null;
  readonly currentBatchCount?: number | null;
  readonly currentExpressCount?: number | null;
  readonly currentMaxiCount?: number | null;
  readonly lastBatchAssignedAt?: string | null;
  readonly averageRating?: number | null;
  readonly reviewCount?: number | null;
  readonly totalReports?: number | null;
  readonly availabilityStatus?: CourierAvailabilityStatus | keyof typeof CourierAvailabilityStatus | null;
  readonly lastLocationUpdateAt?: string | null;
  readonly fleetMemberships: AsyncCollection<FleetMember>;
  readonly fleetVehicles: AsyncCollection<FleetVehicle>;
  readonly fleetOrders: AsyncCollection<FleetOrder>;
  readonly fleetInvitations: AsyncCollection<FleetInvitation>;
  readonly reviews: AsyncCollection<CourierReview>;
  readonly reports: AsyncCollection<CourierReport>;
  readonly statusKey?: string | null;
  readonly offers: AsyncCollection<Offer>;
  readonly orders: AsyncCollection<Order>;
  readonly walletID?: string | null;
  readonly wallet: AsyncItem<Wallet | undefined>;
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
  readonly isBlocked?: boolean | null;
  readonly push_token?: string | null;
  readonly courierReviews?: (CourierReview | null)[] | null;
  readonly courierReports?: (CourierReport | null)[] | null;
  readonly Orders?: (Order | null)[] | null;
  readonly payments?: (Payment | null)[] | null;
  readonly paymentMethods?: (PaymentMethod | null)[] | null;
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
  readonly isBlocked?: boolean | null;
  readonly push_token?: string | null;
  readonly courierReviews: AsyncCollection<CourierReview>;
  readonly courierReports: AsyncCollection<CourierReport>;
  readonly Orders: AsyncCollection<Order>;
  readonly payments: AsyncCollection<Payment>;
  readonly paymentMethods: AsyncCollection<PaymentMethod>;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export declare type User = LazyLoading extends LazyLoadingDisabled ? EagerUser : LazyUser

export declare const User: (new (init: ModelInit<User>) => User) & {
  copyOf(source: User, mutator: (draft: MutableModel<User>) => MutableModel<User> | void): User;
}