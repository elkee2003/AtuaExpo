/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getFleetWallet = /* GraphQL */ `
  query GetFleetWallet($id: ID!) {
    getFleetWallet(id: $id) {
      id
      fleetID
      availableBalance
      pendingBalance
      lifetimeEarnings
      fleet {
        id
        name
        businessName
        organisationType
        legalStatus
        verificationStatus
        registrationNumber
        registrationCountry
        registrationAuthority
        isRecognisedBrand
        brandWebsite
        verificationNotes
        logo
        phoneNumber
        email
        address
        state
        city
        landmark
        lat
        lng
        status
        ownerUserID
        subscriptionPlan
        subscriptionStatus
        subscriptionStartedAt
        subscriptionRenewsAt
        trialEndsAt
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      transactions {
        nextToken
        startedAt
        __typename
      }
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listFleetWallets = /* GraphQL */ `
  query ListFleetWallets(
    $filter: ModelFleetWalletFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listFleetWallets(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        fleetID
        availableBalance
        pendingBalance
        lifetimeEarnings
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncFleetWallets = /* GraphQL */ `
  query SyncFleetWallets(
    $filter: ModelFleetWalletFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncFleetWallets(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        fleetID
        availableBalance
        pendingBalance
        lifetimeEarnings
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetWalletsByFleetID = /* GraphQL */ `
  query FleetWalletsByFleetID(
    $fleetID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetWalletFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetWalletsByFleetID(
      fleetID: $fleetID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetID
        availableBalance
        pendingBalance
        lifetimeEarnings
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getFleetTransaction = /* GraphQL */ `
  query GetFleetTransaction($id: ID!) {
    getFleetTransaction(id: $id) {
      id
      fleetWalletID
      fleetID
      orderID
      type
      status
      amount
      description
      reference
      fleet {
        id
        name
        businessName
        organisationType
        legalStatus
        verificationStatus
        registrationNumber
        registrationCountry
        registrationAuthority
        isRecognisedBrand
        brandWebsite
        verificationNotes
        logo
        phoneNumber
        email
        address
        state
        city
        landmark
        lat
        lng
        status
        ownerUserID
        subscriptionPlan
        subscriptionStatus
        subscriptionStartedAt
        subscriptionRenewsAt
        trialEndsAt
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      fleetWallet {
        id
        fleetID
        availableBalance
        pendingBalance
        lifetimeEarnings
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      order {
        id
        senderName
        senderNumber
        senderNumber2
        recipientName
        recipientNumber
        recipientNumber2
        orderDetails
        originAddress
        originState
        originLat
        originLng
        destinationAddress
        destinationState
        destinationLat
        destinationLng
        tripType
        distance
        transportationType
        vehicleClass
        status
        cancellationStatus
        refundStatus
        cancellationFee
        refundAmount
        cancellationReason
        cancellationReasonNote
        cancellationStage
        cancellationRequestedAt
        cancellationProcessedAt
        refundReference
        refundRequestedAt
        refundedAt
        hasNewOffer
        lastOfferAt
        lastOfferSenderType
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
        operationalFare
        courierEarnings
        commissionAmount
        platformFee
        platformServiceRevenue
        vatAmount
        platformNetRevenue
        deliveryVerificationCode
        declaredWeightBracket
        senderPreTransferPhotos
        senderPreTransferVideo
        senderPreTransferRecordedAt
        senderPreTransferLocalPhotos
        senderPreTransferLocalVideo
        mediaUploadStatus
        courierPreTransferUploadStatus
        courierPostLoadingUploadStatus
        dropoffUploadStatus
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPreTransferLocalPhotos
        courierPreTransferLocalVideo
        courierPostLoadingPhotos
        courierPostLoadingVideo
        courierPostLoadingLocalPhotos
        courierPostLoadingLocalVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
        dropoffArrivalLocalPhotos
        dropoffArrivalLocalVideo
        postDeliveryPhotos
        postDeliveryVideo
        pickupLoadingResponsibility
        pickupFloorLevel
        pickupFloorLevelPrice
        pickupHasElevator
        dropoffUnloadingResponsibility
        dropoffFloorLevel
        dropoffFloorLevelPrice
        dropoffHasElevator
        acceptedAt
        arrivedPickupAt
        loadingStartedAt
        tripStartedAt
        arrivedDropoffAt
        unloadingCompletedAt
        logisticsCompanyId
        waybillNumber
        waybillPhoto
        logisticsTrackingCode
        logisticsTrackingStatus
        handedOverToLogisticsAt
        logisticsIntakeConfirmedAt
        acceptedOfferID
        paymentStatus
        paymentID
        paymentReference
        payoutStatus
        fundsStatus
        earningsAllocationStatus
        earningsAllocatedAt
        maxiCountIncrementedAt
        fundsReleaseBlocked
        fundsHoldReason
        fundsHeldBy
        fundsHeldAt
        fundsReleasedAmount
        pickupFundsReleasedAt
        fundsReleasedAt
        fundsReleaseType
        orderEnvironment
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
        trackingStartedAt
        trackingEndedAt
        recipientTrackingToken
        recipientTrackingEnabled
        recipientTrackingRevokedAt
        userID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listFleetTransactions = /* GraphQL */ `
  query ListFleetTransactions(
    $filter: ModelFleetTransactionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listFleetTransactions(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetWalletID
        fleetID
        orderID
        type
        status
        amount
        description
        reference
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncFleetTransactions = /* GraphQL */ `
  query SyncFleetTransactions(
    $filter: ModelFleetTransactionFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncFleetTransactions(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        fleetWalletID
        fleetID
        orderID
        type
        status
        amount
        description
        reference
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetTransactionsByFleetWalletID = /* GraphQL */ `
  query FleetTransactionsByFleetWalletID(
    $fleetWalletID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetTransactionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetTransactionsByFleetWalletID(
      fleetWalletID: $fleetWalletID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetWalletID
        fleetID
        orderID
        type
        status
        amount
        description
        reference
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetTransactionsByFleetID = /* GraphQL */ `
  query FleetTransactionsByFleetID(
    $fleetID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetTransactionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetTransactionsByFleetID(
      fleetID: $fleetID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetWalletID
        fleetID
        orderID
        type
        status
        amount
        description
        reference
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetTransactionsByOrderID = /* GraphQL */ `
  query FleetTransactionsByOrderID(
    $orderID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetTransactionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetTransactionsByOrderID(
      orderID: $orderID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetWalletID
        fleetID
        orderID
        type
        status
        amount
        description
        reference
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetTransactionsByReference = /* GraphQL */ `
  query FleetTransactionsByReference(
    $reference: String!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetTransactionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetTransactionsByReference(
      reference: $reference
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetWalletID
        fleetID
        orderID
        type
        status
        amount
        description
        reference
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getFleetSubscription = /* GraphQL */ `
  query GetFleetSubscription($id: ID!) {
    getFleetSubscription(id: $id) {
      id
      fleetID
      plan
      status
      billingInterval
      amount
      currency
      provider
      providerReference
      startedAt
      currentPeriodStart
      currentPeriodEnd
      cancelledAt
      fleet {
        id
        name
        businessName
        organisationType
        legalStatus
        verificationStatus
        registrationNumber
        registrationCountry
        registrationAuthority
        isRecognisedBrand
        brandWebsite
        verificationNotes
        logo
        phoneNumber
        email
        address
        state
        city
        landmark
        lat
        lng
        status
        ownerUserID
        subscriptionPlan
        subscriptionStatus
        subscriptionStartedAt
        subscriptionRenewsAt
        trialEndsAt
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listFleetSubscriptions = /* GraphQL */ `
  query ListFleetSubscriptions(
    $filter: ModelFleetSubscriptionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listFleetSubscriptions(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetID
        plan
        status
        billingInterval
        amount
        currency
        provider
        providerReference
        startedAt
        currentPeriodStart
        currentPeriodEnd
        cancelledAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncFleetSubscriptions = /* GraphQL */ `
  query SyncFleetSubscriptions(
    $filter: ModelFleetSubscriptionFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncFleetSubscriptions(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        fleetID
        plan
        status
        billingInterval
        amount
        currency
        provider
        providerReference
        startedAt
        currentPeriodStart
        currentPeriodEnd
        cancelledAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetSubscriptionsByFleetID = /* GraphQL */ `
  query FleetSubscriptionsByFleetID(
    $fleetID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetSubscriptionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetSubscriptionsByFleetID(
      fleetID: $fleetID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetID
        plan
        status
        billingInterval
        amount
        currency
        provider
        providerReference
        startedAt
        currentPeriodStart
        currentPeriodEnd
        cancelledAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetSubscriptionsByProviderReference = /* GraphQL */ `
  query FleetSubscriptionsByProviderReference(
    $providerReference: String!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetSubscriptionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetSubscriptionsByProviderReference(
      providerReference: $providerReference
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetID
        plan
        status
        billingInterval
        amount
        currency
        provider
        providerReference
        startedAt
        currentPeriodStart
        currentPeriodEnd
        cancelledAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getFleetOrder = /* GraphQL */ `
  query GetFleetOrder($id: ID!) {
    getFleetOrder(id: $id) {
      id
      fleetID
      orderID
      courierID
      vehicleID
      source
      assignmentType
      assignedAt
      completedAt
      fleetEarnings
      fleet {
        id
        name
        businessName
        organisationType
        legalStatus
        verificationStatus
        registrationNumber
        registrationCountry
        registrationAuthority
        isRecognisedBrand
        brandWebsite
        verificationNotes
        logo
        phoneNumber
        email
        address
        state
        city
        landmark
        lat
        lng
        status
        ownerUserID
        subscriptionPlan
        subscriptionStatus
        subscriptionStartedAt
        subscriptionRenewsAt
        trialEndsAt
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      order {
        id
        senderName
        senderNumber
        senderNumber2
        recipientName
        recipientNumber
        recipientNumber2
        orderDetails
        originAddress
        originState
        originLat
        originLng
        destinationAddress
        destinationState
        destinationLat
        destinationLng
        tripType
        distance
        transportationType
        vehicleClass
        status
        cancellationStatus
        refundStatus
        cancellationFee
        refundAmount
        cancellationReason
        cancellationReasonNote
        cancellationStage
        cancellationRequestedAt
        cancellationProcessedAt
        refundReference
        refundRequestedAt
        refundedAt
        hasNewOffer
        lastOfferAt
        lastOfferSenderType
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
        operationalFare
        courierEarnings
        commissionAmount
        platformFee
        platformServiceRevenue
        vatAmount
        platformNetRevenue
        deliveryVerificationCode
        declaredWeightBracket
        senderPreTransferPhotos
        senderPreTransferVideo
        senderPreTransferRecordedAt
        senderPreTransferLocalPhotos
        senderPreTransferLocalVideo
        mediaUploadStatus
        courierPreTransferUploadStatus
        courierPostLoadingUploadStatus
        dropoffUploadStatus
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPreTransferLocalPhotos
        courierPreTransferLocalVideo
        courierPostLoadingPhotos
        courierPostLoadingVideo
        courierPostLoadingLocalPhotos
        courierPostLoadingLocalVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
        dropoffArrivalLocalPhotos
        dropoffArrivalLocalVideo
        postDeliveryPhotos
        postDeliveryVideo
        pickupLoadingResponsibility
        pickupFloorLevel
        pickupFloorLevelPrice
        pickupHasElevator
        dropoffUnloadingResponsibility
        dropoffFloorLevel
        dropoffFloorLevelPrice
        dropoffHasElevator
        acceptedAt
        arrivedPickupAt
        loadingStartedAt
        tripStartedAt
        arrivedDropoffAt
        unloadingCompletedAt
        logisticsCompanyId
        waybillNumber
        waybillPhoto
        logisticsTrackingCode
        logisticsTrackingStatus
        handedOverToLogisticsAt
        logisticsIntakeConfirmedAt
        acceptedOfferID
        paymentStatus
        paymentID
        paymentReference
        payoutStatus
        fundsStatus
        earningsAllocationStatus
        earningsAllocatedAt
        maxiCountIncrementedAt
        fundsReleaseBlocked
        fundsHoldReason
        fundsHeldBy
        fundsHeldAt
        fundsReleasedAmount
        pickupFundsReleasedAt
        fundsReleasedAt
        fundsReleaseType
        orderEnvironment
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
        trackingStartedAt
        trackingEndedAt
        recipientTrackingToken
        recipientTrackingEnabled
        recipientTrackingRevokedAt
        userID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      courier {
        id
        sub
        isOnline
        isBlocked
        firstName
        lastName
        profilePic
        address
        landMark
        phoneNumber
        email
        courierNIN
        courierNINImage
        bankCode
        bankName
        accountName
        accountNumber
        transportationType
        vehicleClass
        model
        vehicleColour
        plateNumber
        maxiImages
        maxiDescription
        guarantorName
        guarantorLastName
        guarantorProfession
        guarantorNumber
        guarantorRelationship
        guarantorAddress
        guarantorEmail
        guarantorNIN
        guarantorNINImage
        lat
        lng
        heading
        liveLocationID
        isOnboardingComplete
        push_token
        isApproved
        approvedById
        currentBatchCount
        currentExpressCount
        currentMaxiCount
        lastBatchAssignedAt
        averageRating
        reviewCount
        totalReports
        availabilityStatus
        lastLocationUpdateAt
        statusKey
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      vehicle {
        id
        fleetID
        vehicleType
        vehicleClass
        make
        model
        year
        plateNumber
        colour
        status
        assignedCourierID
        assignedAt
        registrationDocument
        insuranceDocument
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listFleetOrders = /* GraphQL */ `
  query ListFleetOrders(
    $filter: ModelFleetOrderFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listFleetOrders(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        fleetID
        orderID
        courierID
        vehicleID
        source
        assignmentType
        assignedAt
        completedAt
        fleetEarnings
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncFleetOrders = /* GraphQL */ `
  query SyncFleetOrders(
    $filter: ModelFleetOrderFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncFleetOrders(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        fleetID
        orderID
        courierID
        vehicleID
        source
        assignmentType
        assignedAt
        completedAt
        fleetEarnings
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetOrdersByFleetID = /* GraphQL */ `
  query FleetOrdersByFleetID(
    $fleetID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetOrderFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetOrdersByFleetID(
      fleetID: $fleetID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetID
        orderID
        courierID
        vehicleID
        source
        assignmentType
        assignedAt
        completedAt
        fleetEarnings
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetOrdersByOrderID = /* GraphQL */ `
  query FleetOrdersByOrderID(
    $orderID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetOrderFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetOrdersByOrderID(
      orderID: $orderID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetID
        orderID
        courierID
        vehicleID
        source
        assignmentType
        assignedAt
        completedAt
        fleetEarnings
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetOrdersByCourierID = /* GraphQL */ `
  query FleetOrdersByCourierID(
    $courierID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetOrderFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetOrdersByCourierID(
      courierID: $courierID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetID
        orderID
        courierID
        vehicleID
        source
        assignmentType
        assignedAt
        completedAt
        fleetEarnings
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetOrdersByVehicleID = /* GraphQL */ `
  query FleetOrdersByVehicleID(
    $vehicleID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetOrderFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetOrdersByVehicleID(
      vehicleID: $vehicleID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetID
        orderID
        courierID
        vehicleID
        source
        assignmentType
        assignedAt
        completedAt
        fleetEarnings
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getFleet = /* GraphQL */ `
  query GetFleet($id: ID!) {
    getFleet(id: $id) {
      id
      name
      businessName
      organisationType
      legalStatus
      verificationStatus
      registrationNumber
      registrationCountry
      registrationAuthority
      isRecognisedBrand
      brandWebsite
      verificationNotes
      logo
      phoneNumber
      email
      address
      state
      city
      landmark
      lat
      lng
      status
      ownerUserID
      subscriptionPlan
      subscriptionStatus
      subscriptionStartedAt
      subscriptionRenewsAt
      trialEndsAt
      members {
        nextToken
        startedAt
        __typename
      }
      vehicles {
        nextToken
        startedAt
        __typename
      }
      invitations {
        nextToken
        startedAt
        __typename
      }
      fleetOrders {
        nextToken
        startedAt
        __typename
      }
      walletID
      wallets {
        nextToken
        startedAt
        __typename
      }
      transactions {
        nextToken
        startedAt
        __typename
      }
      subscriptions {
        nextToken
        startedAt
        __typename
      }
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listFleets = /* GraphQL */ `
  query ListFleets(
    $filter: ModelFleetFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listFleets(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        name
        businessName
        organisationType
        legalStatus
        verificationStatus
        registrationNumber
        registrationCountry
        registrationAuthority
        isRecognisedBrand
        brandWebsite
        verificationNotes
        logo
        phoneNumber
        email
        address
        state
        city
        landmark
        lat
        lng
        status
        ownerUserID
        subscriptionPlan
        subscriptionStatus
        subscriptionStartedAt
        subscriptionRenewsAt
        trialEndsAt
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncFleets = /* GraphQL */ `
  query SyncFleets(
    $filter: ModelFleetFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncFleets(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        name
        businessName
        organisationType
        legalStatus
        verificationStatus
        registrationNumber
        registrationCountry
        registrationAuthority
        isRecognisedBrand
        brandWebsite
        verificationNotes
        logo
        phoneNumber
        email
        address
        state
        city
        landmark
        lat
        lng
        status
        ownerUserID
        subscriptionPlan
        subscriptionStatus
        subscriptionStartedAt
        subscriptionRenewsAt
        trialEndsAt
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetsByOwnerUserID = /* GraphQL */ `
  query FleetsByOwnerUserID(
    $ownerUserID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetsByOwnerUserID(
      ownerUserID: $ownerUserID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        name
        businessName
        organisationType
        legalStatus
        verificationStatus
        registrationNumber
        registrationCountry
        registrationAuthority
        isRecognisedBrand
        brandWebsite
        verificationNotes
        logo
        phoneNumber
        email
        address
        state
        city
        landmark
        lat
        lng
        status
        ownerUserID
        subscriptionPlan
        subscriptionStatus
        subscriptionStartedAt
        subscriptionRenewsAt
        trialEndsAt
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getFleetMember = /* GraphQL */ `
  query GetFleetMember($id: ID!) {
    getFleetMember(id: $id) {
      id
      fleetID
      courierID
      role
      status
      currentVehicleID
      invitedByID
      approvedByID
      joinedAt
      leftAt
      fleet {
        id
        name
        businessName
        organisationType
        legalStatus
        verificationStatus
        registrationNumber
        registrationCountry
        registrationAuthority
        isRecognisedBrand
        brandWebsite
        verificationNotes
        logo
        phoneNumber
        email
        address
        state
        city
        landmark
        lat
        lng
        status
        ownerUserID
        subscriptionPlan
        subscriptionStatus
        subscriptionStartedAt
        subscriptionRenewsAt
        trialEndsAt
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      courier {
        id
        sub
        isOnline
        isBlocked
        firstName
        lastName
        profilePic
        address
        landMark
        phoneNumber
        email
        courierNIN
        courierNINImage
        bankCode
        bankName
        accountName
        accountNumber
        transportationType
        vehicleClass
        model
        vehicleColour
        plateNumber
        maxiImages
        maxiDescription
        guarantorName
        guarantorLastName
        guarantorProfession
        guarantorNumber
        guarantorRelationship
        guarantorAddress
        guarantorEmail
        guarantorNIN
        guarantorNINImage
        lat
        lng
        heading
        liveLocationID
        isOnboardingComplete
        push_token
        isApproved
        approvedById
        currentBatchCount
        currentExpressCount
        currentMaxiCount
        lastBatchAssignedAt
        averageRating
        reviewCount
        totalReports
        availabilityStatus
        lastLocationUpdateAt
        statusKey
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      currentVehicle {
        id
        fleetID
        vehicleType
        vehicleClass
        make
        model
        year
        plateNumber
        colour
        status
        assignedCourierID
        assignedAt
        registrationDocument
        insuranceDocument
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listFleetMembers = /* GraphQL */ `
  query ListFleetMembers(
    $filter: ModelFleetMemberFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listFleetMembers(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        fleetID
        courierID
        role
        status
        currentVehicleID
        invitedByID
        approvedByID
        joinedAt
        leftAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncFleetMembers = /* GraphQL */ `
  query SyncFleetMembers(
    $filter: ModelFleetMemberFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncFleetMembers(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        fleetID
        courierID
        role
        status
        currentVehicleID
        invitedByID
        approvedByID
        joinedAt
        leftAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetMembersByFleetID = /* GraphQL */ `
  query FleetMembersByFleetID(
    $fleetID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetMemberFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetMembersByFleetID(
      fleetID: $fleetID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetID
        courierID
        role
        status
        currentVehicleID
        invitedByID
        approvedByID
        joinedAt
        leftAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetMembersByCourierID = /* GraphQL */ `
  query FleetMembersByCourierID(
    $courierID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetMemberFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetMembersByCourierID(
      courierID: $courierID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetID
        courierID
        role
        status
        currentVehicleID
        invitedByID
        approvedByID
        joinedAt
        leftAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetMembersByCurrentVehicleID = /* GraphQL */ `
  query FleetMembersByCurrentVehicleID(
    $currentVehicleID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetMemberFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetMembersByCurrentVehicleID(
      currentVehicleID: $currentVehicleID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetID
        courierID
        role
        status
        currentVehicleID
        invitedByID
        approvedByID
        joinedAt
        leftAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getFleetInvitation = /* GraphQL */ `
  query GetFleetInvitation($id: ID!) {
    getFleetInvitation(id: $id) {
      id
      fleetID
      courierID
      phoneNumber
      email
      role
      status
      invitationCode
      invitedByID
      expiresAt
      acceptedAt
      fleet {
        id
        name
        businessName
        organisationType
        legalStatus
        verificationStatus
        registrationNumber
        registrationCountry
        registrationAuthority
        isRecognisedBrand
        brandWebsite
        verificationNotes
        logo
        phoneNumber
        email
        address
        state
        city
        landmark
        lat
        lng
        status
        ownerUserID
        subscriptionPlan
        subscriptionStatus
        subscriptionStartedAt
        subscriptionRenewsAt
        trialEndsAt
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      courier {
        id
        sub
        isOnline
        isBlocked
        firstName
        lastName
        profilePic
        address
        landMark
        phoneNumber
        email
        courierNIN
        courierNINImage
        bankCode
        bankName
        accountName
        accountNumber
        transportationType
        vehicleClass
        model
        vehicleColour
        plateNumber
        maxiImages
        maxiDescription
        guarantorName
        guarantorLastName
        guarantorProfession
        guarantorNumber
        guarantorRelationship
        guarantorAddress
        guarantorEmail
        guarantorNIN
        guarantorNINImage
        lat
        lng
        heading
        liveLocationID
        isOnboardingComplete
        push_token
        isApproved
        approvedById
        currentBatchCount
        currentExpressCount
        currentMaxiCount
        lastBatchAssignedAt
        averageRating
        reviewCount
        totalReports
        availabilityStatus
        lastLocationUpdateAt
        statusKey
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listFleetInvitations = /* GraphQL */ `
  query ListFleetInvitations(
    $filter: ModelFleetInvitationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listFleetInvitations(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetID
        courierID
        phoneNumber
        email
        role
        status
        invitationCode
        invitedByID
        expiresAt
        acceptedAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncFleetInvitations = /* GraphQL */ `
  query SyncFleetInvitations(
    $filter: ModelFleetInvitationFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncFleetInvitations(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        fleetID
        courierID
        phoneNumber
        email
        role
        status
        invitationCode
        invitedByID
        expiresAt
        acceptedAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetInvitationsByFleetID = /* GraphQL */ `
  query FleetInvitationsByFleetID(
    $fleetID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetInvitationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetInvitationsByFleetID(
      fleetID: $fleetID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetID
        courierID
        phoneNumber
        email
        role
        status
        invitationCode
        invitedByID
        expiresAt
        acceptedAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetInvitationsByCourierID = /* GraphQL */ `
  query FleetInvitationsByCourierID(
    $courierID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetInvitationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetInvitationsByCourierID(
      courierID: $courierID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetID
        courierID
        phoneNumber
        email
        role
        status
        invitationCode
        invitedByID
        expiresAt
        acceptedAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetInvitationsByInvitationCode = /* GraphQL */ `
  query FleetInvitationsByInvitationCode(
    $invitationCode: String!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetInvitationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetInvitationsByInvitationCode(
      invitationCode: $invitationCode
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetID
        courierID
        phoneNumber
        email
        role
        status
        invitationCode
        invitedByID
        expiresAt
        acceptedAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getFleetVehicle = /* GraphQL */ `
  query GetFleetVehicle($id: ID!) {
    getFleetVehicle(id: $id) {
      id
      fleetID
      vehicleType
      vehicleClass
      make
      model
      year
      plateNumber
      colour
      status
      assignedCourierID
      assignedAt
      registrationDocument
      insuranceDocument
      fleet {
        id
        name
        businessName
        organisationType
        legalStatus
        verificationStatus
        registrationNumber
        registrationCountry
        registrationAuthority
        isRecognisedBrand
        brandWebsite
        verificationNotes
        logo
        phoneNumber
        email
        address
        state
        city
        landmark
        lat
        lng
        status
        ownerUserID
        subscriptionPlan
        subscriptionStatus
        subscriptionStartedAt
        subscriptionRenewsAt
        trialEndsAt
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      assignedCourier {
        id
        sub
        isOnline
        isBlocked
        firstName
        lastName
        profilePic
        address
        landMark
        phoneNumber
        email
        courierNIN
        courierNINImage
        bankCode
        bankName
        accountName
        accountNumber
        transportationType
        vehicleClass
        model
        vehicleColour
        plateNumber
        maxiImages
        maxiDescription
        guarantorName
        guarantorLastName
        guarantorProfession
        guarantorNumber
        guarantorRelationship
        guarantorAddress
        guarantorEmail
        guarantorNIN
        guarantorNINImage
        lat
        lng
        heading
        liveLocationID
        isOnboardingComplete
        push_token
        isApproved
        approvedById
        currentBatchCount
        currentExpressCount
        currentMaxiCount
        lastBatchAssignedAt
        averageRating
        reviewCount
        totalReports
        availabilityStatus
        lastLocationUpdateAt
        statusKey
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      assignedMembers {
        nextToken
        startedAt
        __typename
      }
      fleetOrders {
        nextToken
        startedAt
        __typename
      }
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listFleetVehicles = /* GraphQL */ `
  query ListFleetVehicles(
    $filter: ModelFleetVehicleFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listFleetVehicles(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        fleetID
        vehicleType
        vehicleClass
        make
        model
        year
        plateNumber
        colour
        status
        assignedCourierID
        assignedAt
        registrationDocument
        insuranceDocument
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncFleetVehicles = /* GraphQL */ `
  query SyncFleetVehicles(
    $filter: ModelFleetVehicleFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncFleetVehicles(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        fleetID
        vehicleType
        vehicleClass
        make
        model
        year
        plateNumber
        colour
        status
        assignedCourierID
        assignedAt
        registrationDocument
        insuranceDocument
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetVehiclesByFleetID = /* GraphQL */ `
  query FleetVehiclesByFleetID(
    $fleetID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetVehicleFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetVehiclesByFleetID(
      fleetID: $fleetID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetID
        vehicleType
        vehicleClass
        make
        model
        year
        plateNumber
        colour
        status
        assignedCourierID
        assignedAt
        registrationDocument
        insuranceDocument
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const fleetVehiclesByAssignedCourierID = /* GraphQL */ `
  query FleetVehiclesByAssignedCourierID(
    $assignedCourierID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelFleetVehicleFilterInput
    $limit: Int
    $nextToken: String
  ) {
    fleetVehiclesByAssignedCourierID(
      assignedCourierID: $assignedCourierID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        fleetID
        vehicleType
        vehicleClass
        make
        model
        year
        plateNumber
        colour
        status
        assignedCourierID
        assignedAt
        registrationDocument
        insuranceDocument
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getPaymentMethod = /* GraphQL */ `
  query GetPaymentMethod($id: ID!) {
    getPaymentMethod(id: $id) {
      id
      owner
      userID
      user {
        id
        sub
        firstName
        lastName
        email
        phoneNumber
        profilePic
        address
        exactAddress
        lat
        lng
        isBlocked
        push_token
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      paystackEnvironment
      provider
      authorizationCode
      signature
      cardType
      last4
      expMonth
      expYear
      bank
      countryCode
      channel
      reusable
      email
      isDefault
      status
      deactivatedAt
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listPaymentMethods = /* GraphQL */ `
  query ListPaymentMethods(
    $filter: ModelPaymentMethodFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listPaymentMethods(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        owner
        userID
        paystackEnvironment
        provider
        authorizationCode
        signature
        cardType
        last4
        expMonth
        expYear
        bank
        countryCode
        channel
        reusable
        email
        isDefault
        status
        deactivatedAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncPaymentMethods = /* GraphQL */ `
  query SyncPaymentMethods(
    $filter: ModelPaymentMethodFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncPaymentMethods(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        owner
        userID
        paystackEnvironment
        provider
        authorizationCode
        signature
        cardType
        last4
        expMonth
        expYear
        bank
        countryCode
        channel
        reusable
        email
        isDefault
        status
        deactivatedAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const paymentMethodsByOwner = /* GraphQL */ `
  query PaymentMethodsByOwner(
    $owner: String!
    $sortDirection: ModelSortDirection
    $filter: ModelPaymentMethodFilterInput
    $limit: Int
    $nextToken: String
  ) {
    paymentMethodsByOwner(
      owner: $owner
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        owner
        userID
        paystackEnvironment
        provider
        authorizationCode
        signature
        cardType
        last4
        expMonth
        expYear
        bank
        countryCode
        channel
        reusable
        email
        isDefault
        status
        deactivatedAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const paymentMethodsByUser = /* GraphQL */ `
  query PaymentMethodsByUser(
    $userID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelPaymentMethodFilterInput
    $limit: Int
    $nextToken: String
  ) {
    paymentMethodsByUser(
      userID: $userID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        owner
        userID
        paystackEnvironment
        provider
        authorizationCode
        signature
        cardType
        last4
        expMonth
        expYear
        bank
        countryCode
        channel
        reusable
        email
        isDefault
        status
        deactivatedAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getPayout = /* GraphQL */ `
  query GetPayout($id: ID!) {
    getPayout(id: $id) {
      id
      courierID
      walletID
      amount
      payoutFee
      totalWalletDebit
      status
      bankName
      accountNumber
      reference
      transferCode
      transferID
      failureReason
      payoutMethod
      payoutSource
      processedAt
      paidAt
      failedAt
      walletRestoredAt
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listPayouts = /* GraphQL */ `
  query ListPayouts(
    $filter: ModelPayoutFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listPayouts(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        courierID
        walletID
        amount
        payoutFee
        totalWalletDebit
        status
        bankName
        accountNumber
        reference
        transferCode
        transferID
        failureReason
        payoutMethod
        payoutSource
        processedAt
        paidAt
        failedAt
        walletRestoredAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncPayouts = /* GraphQL */ `
  query SyncPayouts(
    $filter: ModelPayoutFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncPayouts(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        courierID
        walletID
        amount
        payoutFee
        totalWalletDebit
        status
        bankName
        accountNumber
        reference
        transferCode
        transferID
        failureReason
        payoutMethod
        payoutSource
        processedAt
        paidAt
        failedAt
        walletRestoredAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const payoutsByCourierID = /* GraphQL */ `
  query PayoutsByCourierID(
    $courierID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelPayoutFilterInput
    $limit: Int
    $nextToken: String
  ) {
    payoutsByCourierID(
      courierID: $courierID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        courierID
        walletID
        amount
        payoutFee
        totalWalletDebit
        status
        bankName
        accountNumber
        reference
        transferCode
        transferID
        failureReason
        payoutMethod
        payoutSource
        processedAt
        paidAt
        failedAt
        walletRestoredAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const payoutsByWalletID = /* GraphQL */ `
  query PayoutsByWalletID(
    $walletID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelPayoutFilterInput
    $limit: Int
    $nextToken: String
  ) {
    payoutsByWalletID(
      walletID: $walletID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        courierID
        walletID
        amount
        payoutFee
        totalWalletDebit
        status
        bankName
        accountNumber
        reference
        transferCode
        transferID
        failureReason
        payoutMethod
        payoutSource
        processedAt
        paidAt
        failedAt
        walletRestoredAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const payoutsByReference = /* GraphQL */ `
  query PayoutsByReference(
    $reference: String!
    $sortDirection: ModelSortDirection
    $filter: ModelPayoutFilterInput
    $limit: Int
    $nextToken: String
  ) {
    payoutsByReference(
      reference: $reference
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        courierID
        walletID
        amount
        payoutFee
        totalWalletDebit
        status
        bankName
        accountNumber
        reference
        transferCode
        transferID
        failureReason
        payoutMethod
        payoutSource
        processedAt
        paidAt
        failedAt
        walletRestoredAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getTransaction = /* GraphQL */ `
  query GetTransaction($id: ID!) {
    getTransaction(id: $id) {
      id
      walletID
      payoutID
      type
      amount
      description
      orderID
      paymentID
      reference
      status
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listTransactions = /* GraphQL */ `
  query ListTransactions(
    $filter: ModelTransactionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listTransactions(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        walletID
        payoutID
        type
        amount
        description
        orderID
        paymentID
        reference
        status
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncTransactions = /* GraphQL */ `
  query SyncTransactions(
    $filter: ModelTransactionFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncTransactions(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        walletID
        payoutID
        type
        amount
        description
        orderID
        paymentID
        reference
        status
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const transactionsByWalletID = /* GraphQL */ `
  query TransactionsByWalletID(
    $walletID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelTransactionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    transactionsByWalletID(
      walletID: $walletID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        walletID
        payoutID
        type
        amount
        description
        orderID
        paymentID
        reference
        status
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const transactionsByPayoutID = /* GraphQL */ `
  query TransactionsByPayoutID(
    $payoutID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelTransactionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    transactionsByPayoutID(
      payoutID: $payoutID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        walletID
        payoutID
        type
        amount
        description
        orderID
        paymentID
        reference
        status
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const transactionsByOrderID = /* GraphQL */ `
  query TransactionsByOrderID(
    $orderID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelTransactionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    transactionsByOrderID(
      orderID: $orderID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        walletID
        payoutID
        type
        amount
        description
        orderID
        paymentID
        reference
        status
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const transactionsByPaymentID = /* GraphQL */ `
  query TransactionsByPaymentID(
    $paymentID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelTransactionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    transactionsByPaymentID(
      paymentID: $paymentID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        walletID
        payoutID
        type
        amount
        description
        orderID
        paymentID
        reference
        status
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const transactionsByReference = /* GraphQL */ `
  query TransactionsByReference(
    $reference: String!
    $sortDirection: ModelSortDirection
    $filter: ModelTransactionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    transactionsByReference(
      reference: $reference
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        walletID
        payoutID
        type
        amount
        description
        orderID
        paymentID
        reference
        status
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getWallet = /* GraphQL */ `
  query GetWallet($id: ID!) {
    getWallet(id: $id) {
      id
      ownerID
      ownerType
      availableBalance
      pendingBalance
      lifetimeEarnings
      transactions {
        nextToken
        startedAt
        __typename
      }
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listWallets = /* GraphQL */ `
  query ListWallets(
    $filter: ModelWalletFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listWallets(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        ownerID
        ownerType
        availableBalance
        pendingBalance
        lifetimeEarnings
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncWallets = /* GraphQL */ `
  query SyncWallets(
    $filter: ModelWalletFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncWallets(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        ownerID
        ownerType
        availableBalance
        pendingBalance
        lifetimeEarnings
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getPayment = /* GraphQL */ `
  query GetPayment($id: ID!) {
    getPayment(id: $id) {
      id
      orderID
      userID
      amount
      currency
      status
      paymentMethod
      provider
      reference
      order {
        id
        senderName
        senderNumber
        senderNumber2
        recipientName
        recipientNumber
        recipientNumber2
        orderDetails
        originAddress
        originState
        originLat
        originLng
        destinationAddress
        destinationState
        destinationLat
        destinationLng
        tripType
        distance
        transportationType
        vehicleClass
        status
        cancellationStatus
        refundStatus
        cancellationFee
        refundAmount
        cancellationReason
        cancellationReasonNote
        cancellationStage
        cancellationRequestedAt
        cancellationProcessedAt
        refundReference
        refundRequestedAt
        refundedAt
        hasNewOffer
        lastOfferAt
        lastOfferSenderType
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
        operationalFare
        courierEarnings
        commissionAmount
        platformFee
        platformServiceRevenue
        vatAmount
        platformNetRevenue
        deliveryVerificationCode
        declaredWeightBracket
        senderPreTransferPhotos
        senderPreTransferVideo
        senderPreTransferRecordedAt
        senderPreTransferLocalPhotos
        senderPreTransferLocalVideo
        mediaUploadStatus
        courierPreTransferUploadStatus
        courierPostLoadingUploadStatus
        dropoffUploadStatus
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPreTransferLocalPhotos
        courierPreTransferLocalVideo
        courierPostLoadingPhotos
        courierPostLoadingVideo
        courierPostLoadingLocalPhotos
        courierPostLoadingLocalVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
        dropoffArrivalLocalPhotos
        dropoffArrivalLocalVideo
        postDeliveryPhotos
        postDeliveryVideo
        pickupLoadingResponsibility
        pickupFloorLevel
        pickupFloorLevelPrice
        pickupHasElevator
        dropoffUnloadingResponsibility
        dropoffFloorLevel
        dropoffFloorLevelPrice
        dropoffHasElevator
        acceptedAt
        arrivedPickupAt
        loadingStartedAt
        tripStartedAt
        arrivedDropoffAt
        unloadingCompletedAt
        logisticsCompanyId
        waybillNumber
        waybillPhoto
        logisticsTrackingCode
        logisticsTrackingStatus
        handedOverToLogisticsAt
        logisticsIntakeConfirmedAt
        acceptedOfferID
        paymentStatus
        paymentID
        paymentReference
        payoutStatus
        fundsStatus
        earningsAllocationStatus
        earningsAllocatedAt
        maxiCountIncrementedAt
        fundsReleaseBlocked
        fundsHoldReason
        fundsHeldBy
        fundsHeldAt
        fundsReleasedAmount
        pickupFundsReleasedAt
        fundsReleasedAt
        fundsReleaseType
        orderEnvironment
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
        trackingStartedAt
        trackingEndedAt
        recipientTrackingToken
        recipientTrackingEnabled
        recipientTrackingRevokedAt
        userID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      user {
        id
        sub
        firstName
        lastName
        email
        phoneNumber
        profilePic
        address
        exactAddress
        lat
        lng
        isBlocked
        push_token
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listPayments = /* GraphQL */ `
  query ListPayments(
    $filter: ModelPaymentFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listPayments(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        orderID
        userID
        amount
        currency
        status
        paymentMethod
        provider
        reference
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncPayments = /* GraphQL */ `
  query SyncPayments(
    $filter: ModelPaymentFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncPayments(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        orderID
        userID
        amount
        currency
        status
        paymentMethod
        provider
        reference
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const paymentsByOrderID = /* GraphQL */ `
  query PaymentsByOrderID(
    $orderID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelPaymentFilterInput
    $limit: Int
    $nextToken: String
  ) {
    paymentsByOrderID(
      orderID: $orderID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        orderID
        userID
        amount
        currency
        status
        paymentMethod
        provider
        reference
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const paymentsByUserID = /* GraphQL */ `
  query PaymentsByUserID(
    $userID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelPaymentFilterInput
    $limit: Int
    $nextToken: String
  ) {
    paymentsByUserID(
      userID: $userID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        orderID
        userID
        amount
        currency
        status
        paymentMethod
        provider
        reference
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const paymentsByReference = /* GraphQL */ `
  query PaymentsByReference(
    $reference: String!
    $sortDirection: ModelSortDirection
    $filter: ModelPaymentFilterInput
    $limit: Int
    $nextToken: String
  ) {
    paymentsByReference(
      reference: $reference
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        orderID
        userID
        amount
        currency
        status
        paymentMethod
        provider
        reference
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getOffer = /* GraphQL */ `
  query GetOffer($id: ID!) {
    getOffer(id: $id) {
      id
      orderID
      order {
        id
        senderName
        senderNumber
        senderNumber2
        recipientName
        recipientNumber
        recipientNumber2
        orderDetails
        originAddress
        originState
        originLat
        originLng
        destinationAddress
        destinationState
        destinationLat
        destinationLng
        tripType
        distance
        transportationType
        vehicleClass
        status
        cancellationStatus
        refundStatus
        cancellationFee
        refundAmount
        cancellationReason
        cancellationReasonNote
        cancellationStage
        cancellationRequestedAt
        cancellationProcessedAt
        refundReference
        refundRequestedAt
        refundedAt
        hasNewOffer
        lastOfferAt
        lastOfferSenderType
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
        operationalFare
        courierEarnings
        commissionAmount
        platformFee
        platformServiceRevenue
        vatAmount
        platformNetRevenue
        deliveryVerificationCode
        declaredWeightBracket
        senderPreTransferPhotos
        senderPreTransferVideo
        senderPreTransferRecordedAt
        senderPreTransferLocalPhotos
        senderPreTransferLocalVideo
        mediaUploadStatus
        courierPreTransferUploadStatus
        courierPostLoadingUploadStatus
        dropoffUploadStatus
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPreTransferLocalPhotos
        courierPreTransferLocalVideo
        courierPostLoadingPhotos
        courierPostLoadingVideo
        courierPostLoadingLocalPhotos
        courierPostLoadingLocalVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
        dropoffArrivalLocalPhotos
        dropoffArrivalLocalVideo
        postDeliveryPhotos
        postDeliveryVideo
        pickupLoadingResponsibility
        pickupFloorLevel
        pickupFloorLevelPrice
        pickupHasElevator
        dropoffUnloadingResponsibility
        dropoffFloorLevel
        dropoffFloorLevelPrice
        dropoffHasElevator
        acceptedAt
        arrivedPickupAt
        loadingStartedAt
        tripStartedAt
        arrivedDropoffAt
        unloadingCompletedAt
        logisticsCompanyId
        waybillNumber
        waybillPhoto
        logisticsTrackingCode
        logisticsTrackingStatus
        handedOverToLogisticsAt
        logisticsIntakeConfirmedAt
        acceptedOfferID
        paymentStatus
        paymentID
        paymentReference
        payoutStatus
        fundsStatus
        earningsAllocationStatus
        earningsAllocatedAt
        maxiCountIncrementedAt
        fundsReleaseBlocked
        fundsHoldReason
        fundsHeldBy
        fundsHeldAt
        fundsReleasedAmount
        pickupFundsReleasedAt
        fundsReleasedAt
        fundsReleaseType
        orderEnvironment
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
        trackingStartedAt
        trackingEndedAt
        recipientTrackingToken
        recipientTrackingEnabled
        recipientTrackingRevokedAt
        userID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      courierID
      courier {
        id
        sub
        isOnline
        isBlocked
        firstName
        lastName
        profilePic
        address
        landMark
        phoneNumber
        email
        courierNIN
        courierNINImage
        bankCode
        bankName
        accountName
        accountNumber
        transportationType
        vehicleClass
        model
        vehicleColour
        plateNumber
        maxiImages
        maxiDescription
        guarantorName
        guarantorLastName
        guarantorProfession
        guarantorNumber
        guarantorRelationship
        guarantorAddress
        guarantorEmail
        guarantorNIN
        guarantorNINImage
        lat
        lng
        heading
        liveLocationID
        isOnboardingComplete
        push_token
        isApproved
        approvedById
        currentBatchCount
        currentExpressCount
        currentMaxiCount
        lastBatchAssignedAt
        averageRating
        reviewCount
        totalReports
        availabilityStatus
        lastLocationUpdateAt
        statusKey
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      senderType
      amount
      status
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listOffers = /* GraphQL */ `
  query ListOffers(
    $filter: ModelOfferFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listOffers(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        orderID
        courierID
        senderType
        amount
        status
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncOffers = /* GraphQL */ `
  query SyncOffers(
    $filter: ModelOfferFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncOffers(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        orderID
        courierID
        senderType
        amount
        status
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const offersByOrderID = /* GraphQL */ `
  query OffersByOrderID(
    $orderID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelOfferFilterInput
    $limit: Int
    $nextToken: String
  ) {
    offersByOrderID(
      orderID: $orderID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        orderID
        courierID
        senderType
        amount
        status
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const offersByCourierID = /* GraphQL */ `
  query OffersByCourierID(
    $courierID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelOfferFilterInput
    $limit: Int
    $nextToken: String
  ) {
    offersByCourierID(
      courierID: $courierID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        orderID
        courierID
        senderType
        amount
        status
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getOrderCancellation = /* GraphQL */ `
  query GetOrderCancellation($id: ID!) {
    getOrderCancellation(id: $id) {
      id
      orderID
      userID
      courierID
      status
      stage
      reason
      reasonNote
      originalAmount
      cancellationFee
      refundAmount
      refundStatus
      refundReference
      paymentReference
      cancellationRequestedAt
      cancellationProcessedAt
      refundRequestedAt
      refundedAt
      courierReversed
      courierEarningsReversed
      walletReversed
      assignmentReversed
      errorMessage
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listOrderCancellations = /* GraphQL */ `
  query ListOrderCancellations(
    $filter: ModelOrderCancellationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listOrderCancellations(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        orderID
        userID
        courierID
        status
        stage
        reason
        reasonNote
        originalAmount
        cancellationFee
        refundAmount
        refundStatus
        refundReference
        paymentReference
        cancellationRequestedAt
        cancellationProcessedAt
        refundRequestedAt
        refundedAt
        courierReversed
        courierEarningsReversed
        walletReversed
        assignmentReversed
        errorMessage
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncOrderCancellations = /* GraphQL */ `
  query SyncOrderCancellations(
    $filter: ModelOrderCancellationFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncOrderCancellations(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        orderID
        userID
        courierID
        status
        stage
        reason
        reasonNote
        originalAmount
        cancellationFee
        refundAmount
        refundStatus
        refundReference
        paymentReference
        cancellationRequestedAt
        cancellationProcessedAt
        refundRequestedAt
        refundedAt
        courierReversed
        courierEarningsReversed
        walletReversed
        assignmentReversed
        errorMessage
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const orderCancellationsByOrderID = /* GraphQL */ `
  query OrderCancellationsByOrderID(
    $orderID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelOrderCancellationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    orderCancellationsByOrderID(
      orderID: $orderID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        orderID
        userID
        courierID
        status
        stage
        reason
        reasonNote
        originalAmount
        cancellationFee
        refundAmount
        refundStatus
        refundReference
        paymentReference
        cancellationRequestedAt
        cancellationProcessedAt
        refundRequestedAt
        refundedAt
        courierReversed
        courierEarningsReversed
        walletReversed
        assignmentReversed
        errorMessage
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const orderCancellationsByPaymentReference = /* GraphQL */ `
  query OrderCancellationsByPaymentReference(
    $paymentReference: String!
    $sortDirection: ModelSortDirection
    $filter: ModelOrderCancellationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    orderCancellationsByPaymentReference(
      paymentReference: $paymentReference
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        orderID
        userID
        courierID
        status
        stage
        reason
        reasonNote
        originalAmount
        cancellationFee
        refundAmount
        refundStatus
        refundReference
        paymentReference
        cancellationRequestedAt
        cancellationProcessedAt
        refundRequestedAt
        refundedAt
        courierReversed
        courierEarningsReversed
        walletReversed
        assignmentReversed
        errorMessage
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getOrder = /* GraphQL */ `
  query GetOrder($id: ID!) {
    getOrder(id: $id) {
      id
      senderName
      senderNumber
      senderNumber2
      recipientName
      recipientNumber
      recipientNumber2
      orderDetails
      originAddress
      originState
      originLat
      originLng
      destinationAddress
      destinationState
      destinationLat
      destinationLng
      tripType
      distance
      transportationType
      vehicleClass
      status
      cancellationStatus
      refundStatus
      cancellationFee
      refundAmount
      cancellationReason
      cancellationReasonNote
      cancellationStage
      cancellationRequestedAt
      cancellationProcessedAt
      refundReference
      refundRequestedAt
      refundedAt
      hasNewOffer
      lastOfferAt
      lastOfferSenderType
      loadCategory
      isInterState
      estimatedMinPrice
      estimatedMaxPrice
      initialOfferPrice
      loadingFee
      unloadingFee
      floorSurcharge
      fragileSurcharge
      extrasTotal
      totalPrice
      operationalFare
      courierEarnings
      commissionAmount
      platformFee
      platformServiceRevenue
      vatAmount
      platformNetRevenue
      deliveryVerificationCode
      declaredWeightBracket
      senderPreTransferPhotos
      senderPreTransferVideo
      senderPreTransferRecordedAt
      senderPreTransferLocalPhotos
      senderPreTransferLocalVideo
      mediaUploadStatus
      courierPreTransferUploadStatus
      courierPostLoadingUploadStatus
      dropoffUploadStatus
      courierPreTransferPhotos
      courierPreTransferVideo
      courierPreTransferRecordedAt
      courierPreTransferLocalPhotos
      courierPreTransferLocalVideo
      courierPostLoadingPhotos
      courierPostLoadingVideo
      courierPostLoadingLocalPhotos
      courierPostLoadingLocalVideo
      dropoffArrivalPhotos
      dropoffArrivalVideo
      dropoffArrivalLocalPhotos
      dropoffArrivalLocalVideo
      postDeliveryPhotos
      postDeliveryVideo
      pickupLoadingResponsibility
      pickupFloorLevel
      pickupFloorLevelPrice
      pickupHasElevator
      dropoffUnloadingResponsibility
      dropoffFloorLevel
      dropoffFloorLevelPrice
      dropoffHasElevator
      acceptedAt
      arrivedPickupAt
      loadingStartedAt
      tripStartedAt
      arrivedDropoffAt
      unloadingCompletedAt
      logisticsCompanyId
      waybillNumber
      waybillPhoto
      logisticsTrackingCode
      logisticsTrackingStatus
      handedOverToLogisticsAt
      logisticsIntakeConfirmedAt
      acceptedOfferID
      paymentStatus
      paymentID
      paymentReference
      payoutStatus
      fundsStatus
      earningsAllocationStatus
      earningsAllocatedAt
      maxiCountIncrementedAt
      fundsReleaseBlocked
      fundsHoldReason
      fundsHeldBy
      fundsHeldAt
      fundsReleasedAmount
      pickupFundsReleasedAt
      fundsReleasedAt
      fundsReleaseType
      orderEnvironment
      assignedCourierId
      assignmentExpiresAt
      assignmentAttempts
      lastAssignedAt
      rejectedCourierIds
      assignmentStatus
      trackingStartedAt
      trackingEndedAt
      recipientTrackingToken
      recipientTrackingEnabled
      recipientTrackingRevokedAt
      userID
      reviews {
        nextToken
        startedAt
        __typename
      }
      reports {
        nextToken
        startedAt
        __typename
      }
      offers {
        nextToken
        startedAt
        __typename
      }
      assignedCourier {
        id
        sub
        isOnline
        isBlocked
        firstName
        lastName
        profilePic
        address
        landMark
        phoneNumber
        email
        courierNIN
        courierNINImage
        bankCode
        bankName
        accountName
        accountNumber
        transportationType
        vehicleClass
        model
        vehicleColour
        plateNumber
        maxiImages
        maxiDescription
        guarantorName
        guarantorLastName
        guarantorProfession
        guarantorNumber
        guarantorRelationship
        guarantorAddress
        guarantorEmail
        guarantorNIN
        guarantorNINImage
        lat
        lng
        heading
        liveLocationID
        isOnboardingComplete
        push_token
        isApproved
        approvedById
        currentBatchCount
        currentExpressCount
        currentMaxiCount
        lastBatchAssignedAt
        averageRating
        reviewCount
        totalReports
        availabilityStatus
        lastLocationUpdateAt
        statusKey
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      fleetOrders {
        nextToken
        startedAt
        __typename
      }
      fleetTransactions {
        nextToken
        startedAt
        __typename
      }
      payments {
        nextToken
        startedAt
        __typename
      }
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listOrders = /* GraphQL */ `
  query ListOrders(
    $filter: ModelOrderFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listOrders(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        senderName
        senderNumber
        senderNumber2
        recipientName
        recipientNumber
        recipientNumber2
        orderDetails
        originAddress
        originState
        originLat
        originLng
        destinationAddress
        destinationState
        destinationLat
        destinationLng
        tripType
        distance
        transportationType
        vehicleClass
        status
        cancellationStatus
        refundStatus
        cancellationFee
        refundAmount
        cancellationReason
        cancellationReasonNote
        cancellationStage
        cancellationRequestedAt
        cancellationProcessedAt
        refundReference
        refundRequestedAt
        refundedAt
        hasNewOffer
        lastOfferAt
        lastOfferSenderType
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
        operationalFare
        courierEarnings
        commissionAmount
        platformFee
        platformServiceRevenue
        vatAmount
        platformNetRevenue
        deliveryVerificationCode
        declaredWeightBracket
        senderPreTransferPhotos
        senderPreTransferVideo
        senderPreTransferRecordedAt
        senderPreTransferLocalPhotos
        senderPreTransferLocalVideo
        mediaUploadStatus
        courierPreTransferUploadStatus
        courierPostLoadingUploadStatus
        dropoffUploadStatus
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPreTransferLocalPhotos
        courierPreTransferLocalVideo
        courierPostLoadingPhotos
        courierPostLoadingVideo
        courierPostLoadingLocalPhotos
        courierPostLoadingLocalVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
        dropoffArrivalLocalPhotos
        dropoffArrivalLocalVideo
        postDeliveryPhotos
        postDeliveryVideo
        pickupLoadingResponsibility
        pickupFloorLevel
        pickupFloorLevelPrice
        pickupHasElevator
        dropoffUnloadingResponsibility
        dropoffFloorLevel
        dropoffFloorLevelPrice
        dropoffHasElevator
        acceptedAt
        arrivedPickupAt
        loadingStartedAt
        tripStartedAt
        arrivedDropoffAt
        unloadingCompletedAt
        logisticsCompanyId
        waybillNumber
        waybillPhoto
        logisticsTrackingCode
        logisticsTrackingStatus
        handedOverToLogisticsAt
        logisticsIntakeConfirmedAt
        acceptedOfferID
        paymentStatus
        paymentID
        paymentReference
        payoutStatus
        fundsStatus
        earningsAllocationStatus
        earningsAllocatedAt
        maxiCountIncrementedAt
        fundsReleaseBlocked
        fundsHoldReason
        fundsHeldBy
        fundsHeldAt
        fundsReleasedAmount
        pickupFundsReleasedAt
        fundsReleasedAt
        fundsReleaseType
        orderEnvironment
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
        trackingStartedAt
        trackingEndedAt
        recipientTrackingToken
        recipientTrackingEnabled
        recipientTrackingRevokedAt
        userID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncOrders = /* GraphQL */ `
  query SyncOrders(
    $filter: ModelOrderFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncOrders(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        senderName
        senderNumber
        senderNumber2
        recipientName
        recipientNumber
        recipientNumber2
        orderDetails
        originAddress
        originState
        originLat
        originLng
        destinationAddress
        destinationState
        destinationLat
        destinationLng
        tripType
        distance
        transportationType
        vehicleClass
        status
        cancellationStatus
        refundStatus
        cancellationFee
        refundAmount
        cancellationReason
        cancellationReasonNote
        cancellationStage
        cancellationRequestedAt
        cancellationProcessedAt
        refundReference
        refundRequestedAt
        refundedAt
        hasNewOffer
        lastOfferAt
        lastOfferSenderType
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
        operationalFare
        courierEarnings
        commissionAmount
        platformFee
        platformServiceRevenue
        vatAmount
        platformNetRevenue
        deliveryVerificationCode
        declaredWeightBracket
        senderPreTransferPhotos
        senderPreTransferVideo
        senderPreTransferRecordedAt
        senderPreTransferLocalPhotos
        senderPreTransferLocalVideo
        mediaUploadStatus
        courierPreTransferUploadStatus
        courierPostLoadingUploadStatus
        dropoffUploadStatus
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPreTransferLocalPhotos
        courierPreTransferLocalVideo
        courierPostLoadingPhotos
        courierPostLoadingVideo
        courierPostLoadingLocalPhotos
        courierPostLoadingLocalVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
        dropoffArrivalLocalPhotos
        dropoffArrivalLocalVideo
        postDeliveryPhotos
        postDeliveryVideo
        pickupLoadingResponsibility
        pickupFloorLevel
        pickupFloorLevelPrice
        pickupHasElevator
        dropoffUnloadingResponsibility
        dropoffFloorLevel
        dropoffFloorLevelPrice
        dropoffHasElevator
        acceptedAt
        arrivedPickupAt
        loadingStartedAt
        tripStartedAt
        arrivedDropoffAt
        unloadingCompletedAt
        logisticsCompanyId
        waybillNumber
        waybillPhoto
        logisticsTrackingCode
        logisticsTrackingStatus
        handedOverToLogisticsAt
        logisticsIntakeConfirmedAt
        acceptedOfferID
        paymentStatus
        paymentID
        paymentReference
        payoutStatus
        fundsStatus
        earningsAllocationStatus
        earningsAllocatedAt
        maxiCountIncrementedAt
        fundsReleaseBlocked
        fundsHoldReason
        fundsHeldBy
        fundsHeldAt
        fundsReleasedAmount
        pickupFundsReleasedAt
        fundsReleasedAt
        fundsReleaseType
        orderEnvironment
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
        trackingStartedAt
        trackingEndedAt
        recipientTrackingToken
        recipientTrackingEnabled
        recipientTrackingRevokedAt
        userID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const ordersByAssignedCourierId = /* GraphQL */ `
  query OrdersByAssignedCourierId(
    $assignedCourierId: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelOrderFilterInput
    $limit: Int
    $nextToken: String
  ) {
    ordersByAssignedCourierId(
      assignedCourierId: $assignedCourierId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        senderName
        senderNumber
        senderNumber2
        recipientName
        recipientNumber
        recipientNumber2
        orderDetails
        originAddress
        originState
        originLat
        originLng
        destinationAddress
        destinationState
        destinationLat
        destinationLng
        tripType
        distance
        transportationType
        vehicleClass
        status
        cancellationStatus
        refundStatus
        cancellationFee
        refundAmount
        cancellationReason
        cancellationReasonNote
        cancellationStage
        cancellationRequestedAt
        cancellationProcessedAt
        refundReference
        refundRequestedAt
        refundedAt
        hasNewOffer
        lastOfferAt
        lastOfferSenderType
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
        operationalFare
        courierEarnings
        commissionAmount
        platformFee
        platformServiceRevenue
        vatAmount
        platformNetRevenue
        deliveryVerificationCode
        declaredWeightBracket
        senderPreTransferPhotos
        senderPreTransferVideo
        senderPreTransferRecordedAt
        senderPreTransferLocalPhotos
        senderPreTransferLocalVideo
        mediaUploadStatus
        courierPreTransferUploadStatus
        courierPostLoadingUploadStatus
        dropoffUploadStatus
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPreTransferLocalPhotos
        courierPreTransferLocalVideo
        courierPostLoadingPhotos
        courierPostLoadingVideo
        courierPostLoadingLocalPhotos
        courierPostLoadingLocalVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
        dropoffArrivalLocalPhotos
        dropoffArrivalLocalVideo
        postDeliveryPhotos
        postDeliveryVideo
        pickupLoadingResponsibility
        pickupFloorLevel
        pickupFloorLevelPrice
        pickupHasElevator
        dropoffUnloadingResponsibility
        dropoffFloorLevel
        dropoffFloorLevelPrice
        dropoffHasElevator
        acceptedAt
        arrivedPickupAt
        loadingStartedAt
        tripStartedAt
        arrivedDropoffAt
        unloadingCompletedAt
        logisticsCompanyId
        waybillNumber
        waybillPhoto
        logisticsTrackingCode
        logisticsTrackingStatus
        handedOverToLogisticsAt
        logisticsIntakeConfirmedAt
        acceptedOfferID
        paymentStatus
        paymentID
        paymentReference
        payoutStatus
        fundsStatus
        earningsAllocationStatus
        earningsAllocatedAt
        maxiCountIncrementedAt
        fundsReleaseBlocked
        fundsHoldReason
        fundsHeldBy
        fundsHeldAt
        fundsReleasedAmount
        pickupFundsReleasedAt
        fundsReleasedAt
        fundsReleaseType
        orderEnvironment
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
        trackingStartedAt
        trackingEndedAt
        recipientTrackingToken
        recipientTrackingEnabled
        recipientTrackingRevokedAt
        userID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const ordersByAssignmentStatusAndAssignmentExpiresAt = /* GraphQL */ `
  query OrdersByAssignmentStatusAndAssignmentExpiresAt(
    $assignmentStatus: String!
    $assignmentExpiresAt: ModelStringKeyConditionInput
    $sortDirection: ModelSortDirection
    $filter: ModelOrderFilterInput
    $limit: Int
    $nextToken: String
  ) {
    ordersByAssignmentStatusAndAssignmentExpiresAt(
      assignmentStatus: $assignmentStatus
      assignmentExpiresAt: $assignmentExpiresAt
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        senderName
        senderNumber
        senderNumber2
        recipientName
        recipientNumber
        recipientNumber2
        orderDetails
        originAddress
        originState
        originLat
        originLng
        destinationAddress
        destinationState
        destinationLat
        destinationLng
        tripType
        distance
        transportationType
        vehicleClass
        status
        cancellationStatus
        refundStatus
        cancellationFee
        refundAmount
        cancellationReason
        cancellationReasonNote
        cancellationStage
        cancellationRequestedAt
        cancellationProcessedAt
        refundReference
        refundRequestedAt
        refundedAt
        hasNewOffer
        lastOfferAt
        lastOfferSenderType
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
        operationalFare
        courierEarnings
        commissionAmount
        platformFee
        platformServiceRevenue
        vatAmount
        platformNetRevenue
        deliveryVerificationCode
        declaredWeightBracket
        senderPreTransferPhotos
        senderPreTransferVideo
        senderPreTransferRecordedAt
        senderPreTransferLocalPhotos
        senderPreTransferLocalVideo
        mediaUploadStatus
        courierPreTransferUploadStatus
        courierPostLoadingUploadStatus
        dropoffUploadStatus
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPreTransferLocalPhotos
        courierPreTransferLocalVideo
        courierPostLoadingPhotos
        courierPostLoadingVideo
        courierPostLoadingLocalPhotos
        courierPostLoadingLocalVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
        dropoffArrivalLocalPhotos
        dropoffArrivalLocalVideo
        postDeliveryPhotos
        postDeliveryVideo
        pickupLoadingResponsibility
        pickupFloorLevel
        pickupFloorLevelPrice
        pickupHasElevator
        dropoffUnloadingResponsibility
        dropoffFloorLevel
        dropoffFloorLevelPrice
        dropoffHasElevator
        acceptedAt
        arrivedPickupAt
        loadingStartedAt
        tripStartedAt
        arrivedDropoffAt
        unloadingCompletedAt
        logisticsCompanyId
        waybillNumber
        waybillPhoto
        logisticsTrackingCode
        logisticsTrackingStatus
        handedOverToLogisticsAt
        logisticsIntakeConfirmedAt
        acceptedOfferID
        paymentStatus
        paymentID
        paymentReference
        payoutStatus
        fundsStatus
        earningsAllocationStatus
        earningsAllocatedAt
        maxiCountIncrementedAt
        fundsReleaseBlocked
        fundsHoldReason
        fundsHeldBy
        fundsHeldAt
        fundsReleasedAmount
        pickupFundsReleasedAt
        fundsReleasedAt
        fundsReleaseType
        orderEnvironment
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
        trackingStartedAt
        trackingEndedAt
        recipientTrackingToken
        recipientTrackingEnabled
        recipientTrackingRevokedAt
        userID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const ordersByRecipientTrackingToken = /* GraphQL */ `
  query OrdersByRecipientTrackingToken(
    $recipientTrackingToken: String!
    $sortDirection: ModelSortDirection
    $filter: ModelOrderFilterInput
    $limit: Int
    $nextToken: String
  ) {
    ordersByRecipientTrackingToken(
      recipientTrackingToken: $recipientTrackingToken
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        senderName
        senderNumber
        senderNumber2
        recipientName
        recipientNumber
        recipientNumber2
        orderDetails
        originAddress
        originState
        originLat
        originLng
        destinationAddress
        destinationState
        destinationLat
        destinationLng
        tripType
        distance
        transportationType
        vehicleClass
        status
        cancellationStatus
        refundStatus
        cancellationFee
        refundAmount
        cancellationReason
        cancellationReasonNote
        cancellationStage
        cancellationRequestedAt
        cancellationProcessedAt
        refundReference
        refundRequestedAt
        refundedAt
        hasNewOffer
        lastOfferAt
        lastOfferSenderType
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
        operationalFare
        courierEarnings
        commissionAmount
        platformFee
        platformServiceRevenue
        vatAmount
        platformNetRevenue
        deliveryVerificationCode
        declaredWeightBracket
        senderPreTransferPhotos
        senderPreTransferVideo
        senderPreTransferRecordedAt
        senderPreTransferLocalPhotos
        senderPreTransferLocalVideo
        mediaUploadStatus
        courierPreTransferUploadStatus
        courierPostLoadingUploadStatus
        dropoffUploadStatus
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPreTransferLocalPhotos
        courierPreTransferLocalVideo
        courierPostLoadingPhotos
        courierPostLoadingVideo
        courierPostLoadingLocalPhotos
        courierPostLoadingLocalVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
        dropoffArrivalLocalPhotos
        dropoffArrivalLocalVideo
        postDeliveryPhotos
        postDeliveryVideo
        pickupLoadingResponsibility
        pickupFloorLevel
        pickupFloorLevelPrice
        pickupHasElevator
        dropoffUnloadingResponsibility
        dropoffFloorLevel
        dropoffFloorLevelPrice
        dropoffHasElevator
        acceptedAt
        arrivedPickupAt
        loadingStartedAt
        tripStartedAt
        arrivedDropoffAt
        unloadingCompletedAt
        logisticsCompanyId
        waybillNumber
        waybillPhoto
        logisticsTrackingCode
        logisticsTrackingStatus
        handedOverToLogisticsAt
        logisticsIntakeConfirmedAt
        acceptedOfferID
        paymentStatus
        paymentID
        paymentReference
        payoutStatus
        fundsStatus
        earningsAllocationStatus
        earningsAllocatedAt
        maxiCountIncrementedAt
        fundsReleaseBlocked
        fundsHoldReason
        fundsHeldBy
        fundsHeldAt
        fundsReleasedAmount
        pickupFundsReleasedAt
        fundsReleasedAt
        fundsReleaseType
        orderEnvironment
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
        trackingStartedAt
        trackingEndedAt
        recipientTrackingToken
        recipientTrackingEnabled
        recipientTrackingRevokedAt
        userID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const ordersByUserID = /* GraphQL */ `
  query OrdersByUserID(
    $userID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelOrderFilterInput
    $limit: Int
    $nextToken: String
  ) {
    ordersByUserID(
      userID: $userID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        senderName
        senderNumber
        senderNumber2
        recipientName
        recipientNumber
        recipientNumber2
        orderDetails
        originAddress
        originState
        originLat
        originLng
        destinationAddress
        destinationState
        destinationLat
        destinationLng
        tripType
        distance
        transportationType
        vehicleClass
        status
        cancellationStatus
        refundStatus
        cancellationFee
        refundAmount
        cancellationReason
        cancellationReasonNote
        cancellationStage
        cancellationRequestedAt
        cancellationProcessedAt
        refundReference
        refundRequestedAt
        refundedAt
        hasNewOffer
        lastOfferAt
        lastOfferSenderType
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
        operationalFare
        courierEarnings
        commissionAmount
        platformFee
        platformServiceRevenue
        vatAmount
        platformNetRevenue
        deliveryVerificationCode
        declaredWeightBracket
        senderPreTransferPhotos
        senderPreTransferVideo
        senderPreTransferRecordedAt
        senderPreTransferLocalPhotos
        senderPreTransferLocalVideo
        mediaUploadStatus
        courierPreTransferUploadStatus
        courierPostLoadingUploadStatus
        dropoffUploadStatus
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPreTransferLocalPhotos
        courierPreTransferLocalVideo
        courierPostLoadingPhotos
        courierPostLoadingVideo
        courierPostLoadingLocalPhotos
        courierPostLoadingLocalVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
        dropoffArrivalLocalPhotos
        dropoffArrivalLocalVideo
        postDeliveryPhotos
        postDeliveryVideo
        pickupLoadingResponsibility
        pickupFloorLevel
        pickupFloorLevelPrice
        pickupHasElevator
        dropoffUnloadingResponsibility
        dropoffFloorLevel
        dropoffFloorLevelPrice
        dropoffHasElevator
        acceptedAt
        arrivedPickupAt
        loadingStartedAt
        tripStartedAt
        arrivedDropoffAt
        unloadingCompletedAt
        logisticsCompanyId
        waybillNumber
        waybillPhoto
        logisticsTrackingCode
        logisticsTrackingStatus
        handedOverToLogisticsAt
        logisticsIntakeConfirmedAt
        acceptedOfferID
        paymentStatus
        paymentID
        paymentReference
        payoutStatus
        fundsStatus
        earningsAllocationStatus
        earningsAllocatedAt
        maxiCountIncrementedAt
        fundsReleaseBlocked
        fundsHoldReason
        fundsHeldBy
        fundsHeldAt
        fundsReleasedAmount
        pickupFundsReleasedAt
        fundsReleasedAt
        fundsReleaseType
        orderEnvironment
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
        trackingStartedAt
        trackingEndedAt
        recipientTrackingToken
        recipientTrackingEnabled
        recipientTrackingRevokedAt
        userID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getCourierReport = /* GraphQL */ `
  query GetCourierReport($id: ID!) {
    getCourierReport(id: $id) {
      id
      courierID
      courier {
        id
        sub
        isOnline
        isBlocked
        firstName
        lastName
        profilePic
        address
        landMark
        phoneNumber
        email
        courierNIN
        courierNINImage
        bankCode
        bankName
        accountName
        accountNumber
        transportationType
        vehicleClass
        model
        vehicleColour
        plateNumber
        maxiImages
        maxiDescription
        guarantorName
        guarantorLastName
        guarantorProfession
        guarantorNumber
        guarantorRelationship
        guarantorAddress
        guarantorEmail
        guarantorNIN
        guarantorNINImage
        lat
        lng
        heading
        liveLocationID
        isOnboardingComplete
        push_token
        isApproved
        approvedById
        currentBatchCount
        currentExpressCount
        currentMaxiCount
        lastBatchAssignedAt
        averageRating
        reviewCount
        totalReports
        availabilityStatus
        lastLocationUpdateAt
        statusKey
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      userID
      user {
        id
        sub
        firstName
        lastName
        email
        phoneNumber
        profilePic
        address
        exactAddress
        lat
        lng
        isBlocked
        push_token
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      orderID
      order {
        id
        senderName
        senderNumber
        senderNumber2
        recipientName
        recipientNumber
        recipientNumber2
        orderDetails
        originAddress
        originState
        originLat
        originLng
        destinationAddress
        destinationState
        destinationLat
        destinationLng
        tripType
        distance
        transportationType
        vehicleClass
        status
        cancellationStatus
        refundStatus
        cancellationFee
        refundAmount
        cancellationReason
        cancellationReasonNote
        cancellationStage
        cancellationRequestedAt
        cancellationProcessedAt
        refundReference
        refundRequestedAt
        refundedAt
        hasNewOffer
        lastOfferAt
        lastOfferSenderType
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
        operationalFare
        courierEarnings
        commissionAmount
        platformFee
        platformServiceRevenue
        vatAmount
        platformNetRevenue
        deliveryVerificationCode
        declaredWeightBracket
        senderPreTransferPhotos
        senderPreTransferVideo
        senderPreTransferRecordedAt
        senderPreTransferLocalPhotos
        senderPreTransferLocalVideo
        mediaUploadStatus
        courierPreTransferUploadStatus
        courierPostLoadingUploadStatus
        dropoffUploadStatus
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPreTransferLocalPhotos
        courierPreTransferLocalVideo
        courierPostLoadingPhotos
        courierPostLoadingVideo
        courierPostLoadingLocalPhotos
        courierPostLoadingLocalVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
        dropoffArrivalLocalPhotos
        dropoffArrivalLocalVideo
        postDeliveryPhotos
        postDeliveryVideo
        pickupLoadingResponsibility
        pickupFloorLevel
        pickupFloorLevelPrice
        pickupHasElevator
        dropoffUnloadingResponsibility
        dropoffFloorLevel
        dropoffFloorLevelPrice
        dropoffHasElevator
        acceptedAt
        arrivedPickupAt
        loadingStartedAt
        tripStartedAt
        arrivedDropoffAt
        unloadingCompletedAt
        logisticsCompanyId
        waybillNumber
        waybillPhoto
        logisticsTrackingCode
        logisticsTrackingStatus
        handedOverToLogisticsAt
        logisticsIntakeConfirmedAt
        acceptedOfferID
        paymentStatus
        paymentID
        paymentReference
        payoutStatus
        fundsStatus
        earningsAllocationStatus
        earningsAllocatedAt
        maxiCountIncrementedAt
        fundsReleaseBlocked
        fundsHoldReason
        fundsHeldBy
        fundsHeldAt
        fundsReleasedAmount
        pickupFundsReleasedAt
        fundsReleasedAt
        fundsReleaseType
        orderEnvironment
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
        trackingStartedAt
        trackingEndedAt
        recipientTrackingToken
        recipientTrackingEnabled
        recipientTrackingRevokedAt
        userID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      reason
      description
      evidencePhotos
      evidenceVideo
      status
      adminComment
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listCourierReports = /* GraphQL */ `
  query ListCourierReports(
    $filter: ModelCourierReportFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listCourierReports(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        courierID
        userID
        orderID
        reason
        description
        evidencePhotos
        evidenceVideo
        status
        adminComment
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncCourierReports = /* GraphQL */ `
  query SyncCourierReports(
    $filter: ModelCourierReportFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncCourierReports(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        courierID
        userID
        orderID
        reason
        description
        evidencePhotos
        evidenceVideo
        status
        adminComment
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const courierReportsByCourierID = /* GraphQL */ `
  query CourierReportsByCourierID(
    $courierID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelCourierReportFilterInput
    $limit: Int
    $nextToken: String
  ) {
    courierReportsByCourierID(
      courierID: $courierID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        courierID
        userID
        orderID
        reason
        description
        evidencePhotos
        evidenceVideo
        status
        adminComment
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const courierReportsByUserID = /* GraphQL */ `
  query CourierReportsByUserID(
    $userID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelCourierReportFilterInput
    $limit: Int
    $nextToken: String
  ) {
    courierReportsByUserID(
      userID: $userID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        courierID
        userID
        orderID
        reason
        description
        evidencePhotos
        evidenceVideo
        status
        adminComment
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const courierReportsByOrderID = /* GraphQL */ `
  query CourierReportsByOrderID(
    $orderID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelCourierReportFilterInput
    $limit: Int
    $nextToken: String
  ) {
    courierReportsByOrderID(
      orderID: $orderID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        courierID
        userID
        orderID
        reason
        description
        evidencePhotos
        evidenceVideo
        status
        adminComment
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getCourierReview = /* GraphQL */ `
  query GetCourierReview($id: ID!) {
    getCourierReview(id: $id) {
      id
      courierID
      courier {
        id
        sub
        isOnline
        isBlocked
        firstName
        lastName
        profilePic
        address
        landMark
        phoneNumber
        email
        courierNIN
        courierNINImage
        bankCode
        bankName
        accountName
        accountNumber
        transportationType
        vehicleClass
        model
        vehicleColour
        plateNumber
        maxiImages
        maxiDescription
        guarantorName
        guarantorLastName
        guarantorProfession
        guarantorNumber
        guarantorRelationship
        guarantorAddress
        guarantorEmail
        guarantorNIN
        guarantorNINImage
        lat
        lng
        heading
        liveLocationID
        isOnboardingComplete
        push_token
        isApproved
        approvedById
        currentBatchCount
        currentExpressCount
        currentMaxiCount
        lastBatchAssignedAt
        averageRating
        reviewCount
        totalReports
        availabilityStatus
        lastLocationUpdateAt
        statusKey
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      userID
      user {
        id
        sub
        firstName
        lastName
        email
        phoneNumber
        profilePic
        address
        exactAddress
        lat
        lng
        isBlocked
        push_token
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      orderID
      order {
        id
        senderName
        senderNumber
        senderNumber2
        recipientName
        recipientNumber
        recipientNumber2
        orderDetails
        originAddress
        originState
        originLat
        originLng
        destinationAddress
        destinationState
        destinationLat
        destinationLng
        tripType
        distance
        transportationType
        vehicleClass
        status
        cancellationStatus
        refundStatus
        cancellationFee
        refundAmount
        cancellationReason
        cancellationReasonNote
        cancellationStage
        cancellationRequestedAt
        cancellationProcessedAt
        refundReference
        refundRequestedAt
        refundedAt
        hasNewOffer
        lastOfferAt
        lastOfferSenderType
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
        operationalFare
        courierEarnings
        commissionAmount
        platformFee
        platformServiceRevenue
        vatAmount
        platformNetRevenue
        deliveryVerificationCode
        declaredWeightBracket
        senderPreTransferPhotos
        senderPreTransferVideo
        senderPreTransferRecordedAt
        senderPreTransferLocalPhotos
        senderPreTransferLocalVideo
        mediaUploadStatus
        courierPreTransferUploadStatus
        courierPostLoadingUploadStatus
        dropoffUploadStatus
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPreTransferLocalPhotos
        courierPreTransferLocalVideo
        courierPostLoadingPhotos
        courierPostLoadingVideo
        courierPostLoadingLocalPhotos
        courierPostLoadingLocalVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
        dropoffArrivalLocalPhotos
        dropoffArrivalLocalVideo
        postDeliveryPhotos
        postDeliveryVideo
        pickupLoadingResponsibility
        pickupFloorLevel
        pickupFloorLevelPrice
        pickupHasElevator
        dropoffUnloadingResponsibility
        dropoffFloorLevel
        dropoffFloorLevelPrice
        dropoffHasElevator
        acceptedAt
        arrivedPickupAt
        loadingStartedAt
        tripStartedAt
        arrivedDropoffAt
        unloadingCompletedAt
        logisticsCompanyId
        waybillNumber
        waybillPhoto
        logisticsTrackingCode
        logisticsTrackingStatus
        handedOverToLogisticsAt
        logisticsIntakeConfirmedAt
        acceptedOfferID
        paymentStatus
        paymentID
        paymentReference
        payoutStatus
        fundsStatus
        earningsAllocationStatus
        earningsAllocatedAt
        maxiCountIncrementedAt
        fundsReleaseBlocked
        fundsHoldReason
        fundsHeldBy
        fundsHeldAt
        fundsReleasedAmount
        pickupFundsReleasedAt
        fundsReleasedAt
        fundsReleaseType
        orderEnvironment
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
        trackingStartedAt
        trackingEndedAt
        recipientTrackingToken
        recipientTrackingEnabled
        recipientTrackingRevokedAt
        userID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      rating
      comment
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listCourierReviews = /* GraphQL */ `
  query ListCourierReviews(
    $filter: ModelCourierReviewFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listCourierReviews(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        courierID
        userID
        orderID
        rating
        comment
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncCourierReviews = /* GraphQL */ `
  query SyncCourierReviews(
    $filter: ModelCourierReviewFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncCourierReviews(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        courierID
        userID
        orderID
        rating
        comment
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const courierReviewsByCourierID = /* GraphQL */ `
  query CourierReviewsByCourierID(
    $courierID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelCourierReviewFilterInput
    $limit: Int
    $nextToken: String
  ) {
    courierReviewsByCourierID(
      courierID: $courierID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        courierID
        userID
        orderID
        rating
        comment
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const courierReviewsByUserID = /* GraphQL */ `
  query CourierReviewsByUserID(
    $userID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelCourierReviewFilterInput
    $limit: Int
    $nextToken: String
  ) {
    courierReviewsByUserID(
      userID: $userID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        courierID
        userID
        orderID
        rating
        comment
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const courierReviewsByOrderID = /* GraphQL */ `
  query CourierReviewsByOrderID(
    $orderID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelCourierReviewFilterInput
    $limit: Int
    $nextToken: String
  ) {
    courierReviewsByOrderID(
      orderID: $orderID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        courierID
        userID
        orderID
        rating
        comment
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getAdminAlert = /* GraphQL */ `
  query GetAdminAlert($id: ID!) {
    getAdminAlert(id: $id) {
      id
      type
      title
      message
      severity
      status
      payoutID
      payoutMethod
      payoutSource
      courierID
      amount
      courierObligations
      paystackCosts
      totalRequired
      paystackBalance
      topUpRequired
      affectedCourierCount
      createdAt
      readAt
      resolvedAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listAdminAlerts = /* GraphQL */ `
  query ListAdminAlerts(
    $filter: ModelAdminAlertFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listAdminAlerts(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        type
        title
        message
        severity
        status
        payoutID
        payoutMethod
        payoutSource
        courierID
        amount
        courierObligations
        paystackCosts
        totalRequired
        paystackBalance
        topUpRequired
        affectedCourierCount
        createdAt
        readAt
        resolvedAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncAdminAlerts = /* GraphQL */ `
  query SyncAdminAlerts(
    $filter: ModelAdminAlertFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncAdminAlerts(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        type
        title
        message
        severity
        status
        payoutID
        payoutMethod
        payoutSource
        courierID
        amount
        courierObligations
        paystackCosts
        totalRequired
        paystackBalance
        topUpRequired
        affectedCourierCount
        createdAt
        readAt
        resolvedAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getCourierLiveLocation = /* GraphQL */ `
  query GetCourierLiveLocation($id: ID!) {
    getCourierLiveLocation(id: $id) {
      id
      courierID
      courier {
        id
        sub
        isOnline
        isBlocked
        firstName
        lastName
        profilePic
        address
        landMark
        phoneNumber
        email
        courierNIN
        courierNINImage
        bankCode
        bankName
        accountName
        accountNumber
        transportationType
        vehicleClass
        model
        vehicleColour
        plateNumber
        maxiImages
        maxiDescription
        guarantorName
        guarantorLastName
        guarantorProfession
        guarantorNumber
        guarantorRelationship
        guarantorAddress
        guarantorEmail
        guarantorNIN
        guarantorNINImage
        lat
        lng
        heading
        liveLocationID
        isOnboardingComplete
        push_token
        isApproved
        approvedById
        currentBatchCount
        currentExpressCount
        currentMaxiCount
        lastBatchAssignedAt
        averageRating
        reviewCount
        totalReports
        availabilityStatus
        lastLocationUpdateAt
        statusKey
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      latitude
      longitude
      heading
      speed
      accuracy
      altitude
      isTracking
      trackingSource
      lastSeenAt
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listCourierLiveLocations = /* GraphQL */ `
  query ListCourierLiveLocations(
    $filter: ModelCourierLiveLocationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listCourierLiveLocations(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        courierID
        latitude
        longitude
        heading
        speed
        accuracy
        altitude
        isTracking
        trackingSource
        lastSeenAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncCourierLiveLocations = /* GraphQL */ `
  query SyncCourierLiveLocations(
    $filter: ModelCourierLiveLocationFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncCourierLiveLocations(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        courierID
        latitude
        longitude
        heading
        speed
        accuracy
        altitude
        isTracking
        trackingSource
        lastSeenAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const courierLiveLocationsByCourierID = /* GraphQL */ `
  query CourierLiveLocationsByCourierID(
    $courierID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelCourierLiveLocationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    courierLiveLocationsByCourierID(
      courierID: $courierID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        courierID
        latitude
        longitude
        heading
        speed
        accuracy
        altitude
        isTracking
        trackingSource
        lastSeenAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getCourier = /* GraphQL */ `
  query GetCourier($id: ID!) {
    getCourier(id: $id) {
      id
      sub
      isOnline
      isBlocked
      firstName
      lastName
      profilePic
      address
      landMark
      phoneNumber
      email
      courierNIN
      courierNINImage
      bankCode
      bankName
      accountName
      accountNumber
      transportationType
      vehicleClass
      model
      vehicleColour
      plateNumber
      maxiImages
      maxiDescription
      guarantorName
      guarantorLastName
      guarantorProfession
      guarantorNumber
      guarantorRelationship
      guarantorAddress
      guarantorEmail
      guarantorNIN
      guarantorNINImage
      lat
      lng
      heading
      liveLocationID
      liveLocation {
        id
        courierID
        latitude
        longitude
        heading
        speed
        accuracy
        altitude
        isTracking
        trackingSource
        lastSeenAt
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      isOnboardingComplete
      push_token
      isApproved
      approvedById
      currentBatchCount
      currentExpressCount
      currentMaxiCount
      lastBatchAssignedAt
      averageRating
      reviewCount
      totalReports
      availabilityStatus
      lastLocationUpdateAt
      fleetMemberships {
        nextToken
        startedAt
        __typename
      }
      fleetVehicles {
        nextToken
        startedAt
        __typename
      }
      fleetOrders {
        nextToken
        startedAt
        __typename
      }
      fleetInvitations {
        nextToken
        startedAt
        __typename
      }
      reviews {
        nextToken
        startedAt
        __typename
      }
      reports {
        nextToken
        startedAt
        __typename
      }
      statusKey
      offers {
        nextToken
        startedAt
        __typename
      }
      orders {
        nextToken
        startedAt
        __typename
      }
      walletID
      wallet {
        id
        ownerID
        ownerType
        availableBalance
        pendingBalance
        lifetimeEarnings
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listCouriers = /* GraphQL */ `
  query ListCouriers(
    $filter: ModelCourierFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listCouriers(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        sub
        isOnline
        isBlocked
        firstName
        lastName
        profilePic
        address
        landMark
        phoneNumber
        email
        courierNIN
        courierNINImage
        bankCode
        bankName
        accountName
        accountNumber
        transportationType
        vehicleClass
        model
        vehicleColour
        plateNumber
        maxiImages
        maxiDescription
        guarantorName
        guarantorLastName
        guarantorProfession
        guarantorNumber
        guarantorRelationship
        guarantorAddress
        guarantorEmail
        guarantorNIN
        guarantorNINImage
        lat
        lng
        heading
        liveLocationID
        isOnboardingComplete
        push_token
        isApproved
        approvedById
        currentBatchCount
        currentExpressCount
        currentMaxiCount
        lastBatchAssignedAt
        averageRating
        reviewCount
        totalReports
        availabilityStatus
        lastLocationUpdateAt
        statusKey
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncCouriers = /* GraphQL */ `
  query SyncCouriers(
    $filter: ModelCourierFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncCouriers(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        sub
        isOnline
        isBlocked
        firstName
        lastName
        profilePic
        address
        landMark
        phoneNumber
        email
        courierNIN
        courierNINImage
        bankCode
        bankName
        accountName
        accountNumber
        transportationType
        vehicleClass
        model
        vehicleColour
        plateNumber
        maxiImages
        maxiDescription
        guarantorName
        guarantorLastName
        guarantorProfession
        guarantorNumber
        guarantorRelationship
        guarantorAddress
        guarantorEmail
        guarantorNIN
        guarantorNINImage
        lat
        lng
        heading
        liveLocationID
        isOnboardingComplete
        push_token
        isApproved
        approvedById
        currentBatchCount
        currentExpressCount
        currentMaxiCount
        lastBatchAssignedAt
        averageRating
        reviewCount
        totalReports
        availabilityStatus
        lastLocationUpdateAt
        statusKey
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const couriersByStatus = /* GraphQL */ `
  query CouriersByStatus(
    $statusKey: String!
    $sortDirection: ModelSortDirection
    $filter: ModelCourierFilterInput
    $limit: Int
    $nextToken: String
  ) {
    couriersByStatus(
      statusKey: $statusKey
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        sub
        isOnline
        isBlocked
        firstName
        lastName
        profilePic
        address
        landMark
        phoneNumber
        email
        courierNIN
        courierNINImage
        bankCode
        bankName
        accountName
        accountNumber
        transportationType
        vehicleClass
        model
        vehicleColour
        plateNumber
        maxiImages
        maxiDescription
        guarantorName
        guarantorLastName
        guarantorProfession
        guarantorNumber
        guarantorRelationship
        guarantorAddress
        guarantorEmail
        guarantorNIN
        guarantorNINImage
        lat
        lng
        heading
        liveLocationID
        isOnboardingComplete
        push_token
        isApproved
        approvedById
        currentBatchCount
        currentExpressCount
        currentMaxiCount
        lastBatchAssignedAt
        averageRating
        reviewCount
        totalReports
        availabilityStatus
        lastLocationUpdateAt
        statusKey
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const getUser = /* GraphQL */ `
  query GetUser($id: ID!) {
    getUser(id: $id) {
      id
      sub
      firstName
      lastName
      email
      phoneNumber
      profilePic
      address
      exactAddress
      lat
      lng
      isBlocked
      push_token
      courierReviews {
        nextToken
        startedAt
        __typename
      }
      courierReports {
        nextToken
        startedAt
        __typename
      }
      Orders {
        nextToken
        startedAt
        __typename
      }
      payments {
        nextToken
        startedAt
        __typename
      }
      paymentMethods {
        nextToken
        startedAt
        __typename
      }
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listUsers = /* GraphQL */ `
  query ListUsers(
    $filter: ModelUserFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listUsers(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        sub
        firstName
        lastName
        email
        phoneNumber
        profilePic
        address
        exactAddress
        lat
        lng
        isBlocked
        push_token
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
export const syncUsers = /* GraphQL */ `
  query SyncUsers(
    $filter: ModelUserFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncUsers(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        sub
        firstName
        lastName
        email
        phoneNumber
        profilePic
        address
        exactAddress
        lat
        lng
        isBlocked
        push_token
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      nextToken
      startedAt
      __typename
    }
  }
`;
