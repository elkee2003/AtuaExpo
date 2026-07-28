/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getCompanyVehicle = /* GraphQL */ `
  query GetCompanyVehicle($id: ID!) {
    getCompanyVehicle(id: $id) {
      id
      vehicleType
      model
      plateNumber
      couriercompanyID
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listCompanyVehicles = /* GraphQL */ `
  query ListCompanyVehicles(
    $filter: ModelCompanyVehicleFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listCompanyVehicles(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        vehicleType
        model
        plateNumber
        couriercompanyID
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
export const syncCompanyVehicles = /* GraphQL */ `
  query SyncCompanyVehicles(
    $filter: ModelCompanyVehicleFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncCompanyVehicles(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        vehicleType
        model
        plateNumber
        couriercompanyID
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
export const companyVehiclesByCouriercompanyID = /* GraphQL */ `
  query CompanyVehiclesByCouriercompanyID(
    $couriercompanyID: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelCompanyVehicleFilterInput
    $limit: Int
    $nextToken: String
  ) {
    companyVehiclesByCouriercompanyID(
      couriercompanyID: $couriercompanyID
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        vehicleType
        model
        plateNumber
        couriercompanyID
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
export const getCourierCompany = /* GraphQL */ `
  query GetCourierCompany($id: ID!) {
    getCourierCompany(id: $id) {
      id
      sub
      firstName
      lastName
      profilePic
      address
      lat
      lng
      landmark
      phoneNumber
      email
      adminFirstName
      adminLastName
      adminPhoneNumber
      bankName
      CompanyVehicles {
        nextToken
        startedAt
        __typename
      }
      accountNumber
      push_token
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      __typename
    }
  }
`;
export const listCourierCompanies = /* GraphQL */ `
  query ListCourierCompanies(
    $filter: ModelCourierCompanyFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listCourierCompanies(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        sub
        firstName
        lastName
        profilePic
        address
        lat
        lng
        landmark
        phoneNumber
        email
        adminFirstName
        adminLastName
        adminPhoneNumber
        bankName
        accountNumber
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
export const syncCourierCompanies = /* GraphQL */ `
  query SyncCourierCompanies(
    $filter: ModelCourierCompanyFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncCourierCompanies(
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
        profilePic
        address
        lat
        lng
        landmark
        phoneNumber
        email
        adminFirstName
        adminLastName
        adminPhoneNumber
        bankName
        accountNumber
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
export const getPayout = /* GraphQL */ `
  query GetPayout($id: ID!) {
    getPayout(id: $id) {
      id
      courierID
      amount
      status
      bankName
      accountNumber
      reference
      walletID
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
        amount
        status
        bankName
        accountNumber
        reference
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
        amount
        status
        bankName
        accountNumber
        reference
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
        amount
        status
        bankName
        accountNumber
        reference
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
        amount
        status
        bankName
        accountNumber
        reference
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
export const getTransaction = /* GraphQL */ `
  query GetTransaction($id: ID!) {
    getTransaction(id: $id) {
      id
      walletID
      type
      amount
      description
      orderID
      paymentID
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
        type
        amount
        description
        orderID
        paymentID
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
        type
        amount
        description
        orderID
        paymentID
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
        type
        amount
        description
        orderID
        paymentID
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
        type
        amount
        description
        orderID
        paymentID
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
        type
        amount
        description
        orderID
        paymentID
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
      balance
      pendingBalance
      totalEarnings
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
        balance
        pendingBalance
        totalEarnings
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
        balance
        pendingBalance
        totalEarnings
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
        payoutStatus
        fundsStatus
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
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
export const getOffer = /* GraphQL */ `
  query GetOffer($id: ID!) {
    getOffer(id: $id) {
      id
      orderID
      order {
        id
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
        payoutStatus
        fundsStatus
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
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
export const getOrder = /* GraphQL */ `
  query GetOrder($id: ID!) {
    getOrder(id: $id) {
      id
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
      payoutStatus
      fundsStatus
      assignedCourierId
      assignmentExpiresAt
      assignmentAttempts
      lastAssignedAt
      rejectedCourierIds
      assignmentStatus
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
        statusKey
        walletID
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
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
        payoutStatus
        fundsStatus
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
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
        payoutStatus
        fundsStatus
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
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
        payoutStatus
        fundsStatus
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
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
        payoutStatus
        fundsStatus
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
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
        payoutStatus
        fundsStatus
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
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
        payoutStatus
        fundsStatus
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
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
        payoutStatus
        fundsStatus
        assignedCourierId
        assignmentExpiresAt
        assignmentAttempts
        lastAssignedAt
        rejectedCourierIds
        assignmentStatus
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
export const getCourier = /* GraphQL */ `
  query GetCourier($id: ID!) {
    getCourier(id: $id) {
      id
      sub
      isOnline
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
        balance
        pendingBalance
        totalEarnings
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
