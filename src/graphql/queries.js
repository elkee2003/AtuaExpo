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
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        currentOfferPrice
        lastOfferBy
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
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
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPostLoadingPhotos
        courierPostLoadingVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
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
        lastBatchAssignedAt
        statusKey
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
      loadCategory
      isInterState
      estimatedMinPrice
      estimatedMaxPrice
      initialOfferPrice
      currentOfferPrice
      lastOfferBy
      loadingFee
      unloadingFee
      floorSurcharge
      fragileSurcharge
      extrasTotal
      totalPrice
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
      courierPreTransferPhotos
      courierPreTransferVideo
      courierPreTransferRecordedAt
      courierPostLoadingPhotos
      courierPostLoadingVideo
      dropoffArrivalPhotos
      dropoffArrivalVideo
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
      assignedCourierId
      assignmentExpiresAt
      assignmentAttempts
      lastAssignedAt
      rejectedCourierIds
      assignmentStatus
      userID
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
        lastBatchAssignedAt
        statusKey
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
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        currentOfferPrice
        lastOfferBy
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
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
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPostLoadingPhotos
        courierPostLoadingVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
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
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        currentOfferPrice
        lastOfferBy
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
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
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPostLoadingPhotos
        courierPostLoadingVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
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
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        currentOfferPrice
        lastOfferBy
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
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
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPostLoadingPhotos
        courierPostLoadingVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
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
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        currentOfferPrice
        lastOfferBy
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
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
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPostLoadingPhotos
        courierPostLoadingVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
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
        loadCategory
        isInterState
        estimatedMinPrice
        estimatedMaxPrice
        initialOfferPrice
        currentOfferPrice
        lastOfferBy
        loadingFee
        unloadingFee
        floorSurcharge
        fragileSurcharge
        extrasTotal
        totalPrice
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
        courierPreTransferPhotos
        courierPreTransferVideo
        courierPreTransferRecordedAt
        courierPostLoadingPhotos
        courierPostLoadingVideo
        dropoffArrivalPhotos
        dropoffArrivalVideo
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
      lastBatchAssignedAt
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
        lastBatchAssignedAt
        statusKey
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
        lastBatchAssignedAt
        statusKey
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
        lastBatchAssignedAt
        statusKey
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
      push_token
      Orders {
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
