/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createCompanyVehicle = /* GraphQL */ `
  mutation CreateCompanyVehicle(
    $input: CreateCompanyVehicleInput!
    $condition: ModelCompanyVehicleConditionInput
  ) {
    createCompanyVehicle(input: $input, condition: $condition) {
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
export const updateCompanyVehicle = /* GraphQL */ `
  mutation UpdateCompanyVehicle(
    $input: UpdateCompanyVehicleInput!
    $condition: ModelCompanyVehicleConditionInput
  ) {
    updateCompanyVehicle(input: $input, condition: $condition) {
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
export const deleteCompanyVehicle = /* GraphQL */ `
  mutation DeleteCompanyVehicle(
    $input: DeleteCompanyVehicleInput!
    $condition: ModelCompanyVehicleConditionInput
  ) {
    deleteCompanyVehicle(input: $input, condition: $condition) {
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
export const createCourierCompany = /* GraphQL */ `
  mutation CreateCourierCompany(
    $input: CreateCourierCompanyInput!
    $condition: ModelCourierCompanyConditionInput
  ) {
    createCourierCompany(input: $input, condition: $condition) {
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
export const updateCourierCompany = /* GraphQL */ `
  mutation UpdateCourierCompany(
    $input: UpdateCourierCompanyInput!
    $condition: ModelCourierCompanyConditionInput
  ) {
    updateCourierCompany(input: $input, condition: $condition) {
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
export const deleteCourierCompany = /* GraphQL */ `
  mutation DeleteCourierCompany(
    $input: DeleteCourierCompanyInput!
    $condition: ModelCourierCompanyConditionInput
  ) {
    deleteCourierCompany(input: $input, condition: $condition) {
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
export const createOffer = /* GraphQL */ `
  mutation CreateOffer(
    $input: CreateOfferInput!
    $condition: ModelOfferConditionInput
  ) {
    createOffer(input: $input, condition: $condition) {
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
        assignmentStatus
        assignmentExpiresAt
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
export const updateOffer = /* GraphQL */ `
  mutation UpdateOffer(
    $input: UpdateOfferInput!
    $condition: ModelOfferConditionInput
  ) {
    updateOffer(input: $input, condition: $condition) {
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
        assignmentStatus
        assignmentExpiresAt
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
export const deleteOffer = /* GraphQL */ `
  mutation DeleteOffer(
    $input: DeleteOfferInput!
    $condition: ModelOfferConditionInput
  ) {
    deleteOffer(input: $input, condition: $condition) {
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
        assignmentStatus
        assignmentExpiresAt
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
export const createOrder = /* GraphQL */ `
  mutation CreateOrder(
    $input: CreateOrderInput!
    $condition: ModelOrderConditionInput
  ) {
    createOrder(input: $input, condition: $condition) {
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
      assignmentStatus
      assignmentExpiresAt
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
export const updateOrder = /* GraphQL */ `
  mutation UpdateOrder(
    $input: UpdateOrderInput!
    $condition: ModelOrderConditionInput
  ) {
    updateOrder(input: $input, condition: $condition) {
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
      assignmentStatus
      assignmentExpiresAt
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
export const deleteOrder = /* GraphQL */ `
  mutation DeleteOrder(
    $input: DeleteOrderInput!
    $condition: ModelOrderConditionInput
  ) {
    deleteOrder(input: $input, condition: $condition) {
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
      assignmentStatus
      assignmentExpiresAt
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
export const createCourier = /* GraphQL */ `
  mutation CreateCourier(
    $input: CreateCourierInput!
    $condition: ModelCourierConditionInput
  ) {
    createCourier(input: $input, condition: $condition) {
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
export const updateCourier = /* GraphQL */ `
  mutation UpdateCourier(
    $input: UpdateCourierInput!
    $condition: ModelCourierConditionInput
  ) {
    updateCourier(input: $input, condition: $condition) {
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
export const deleteCourier = /* GraphQL */ `
  mutation DeleteCourier(
    $input: DeleteCourierInput!
    $condition: ModelCourierConditionInput
  ) {
    deleteCourier(input: $input, condition: $condition) {
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
export const createUser = /* GraphQL */ `
  mutation CreateUser(
    $input: CreateUserInput!
    $condition: ModelUserConditionInput
  ) {
    createUser(input: $input, condition: $condition) {
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
export const updateUser = /* GraphQL */ `
  mutation UpdateUser(
    $input: UpdateUserInput!
    $condition: ModelUserConditionInput
  ) {
    updateUser(input: $input, condition: $condition) {
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
export const deleteUser = /* GraphQL */ `
  mutation DeleteUser(
    $input: DeleteUserInput!
    $condition: ModelUserConditionInput
  ) {
    deleteUser(input: $input, condition: $condition) {
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
