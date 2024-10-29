/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onCreateCourierCompany = /* GraphQL */ `
  subscription OnCreateCourierCompany(
    $filter: ModelSubscriptionCourierCompanyFilterInput
  ) {
    onCreateCourierCompany(filter: $filter) {
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
export const onUpdateCourierCompany = /* GraphQL */ `
  subscription OnUpdateCourierCompany(
    $filter: ModelSubscriptionCourierCompanyFilterInput
  ) {
    onUpdateCourierCompany(filter: $filter) {
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
export const onDeleteCourierCompany = /* GraphQL */ `
  subscription OnDeleteCourierCompany(
    $filter: ModelSubscriptionCourierCompanyFilterInput
  ) {
    onDeleteCourierCompany(filter: $filter) {
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
export const onCreateCompanyVehicle = /* GraphQL */ `
  subscription OnCreateCompanyVehicle(
    $filter: ModelSubscriptionCompanyVehicleFilterInput
  ) {
    onCreateCompanyVehicle(filter: $filter) {
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
export const onUpdateCompanyVehicle = /* GraphQL */ `
  subscription OnUpdateCompanyVehicle(
    $filter: ModelSubscriptionCompanyVehicleFilterInput
  ) {
    onUpdateCompanyVehicle(filter: $filter) {
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
export const onDeleteCompanyVehicle = /* GraphQL */ `
  subscription OnDeleteCompanyVehicle(
    $filter: ModelSubscriptionCompanyVehicleFilterInput
  ) {
    onDeleteCompanyVehicle(filter: $filter) {
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
export const onCreateOrder = /* GraphQL */ `
  subscription OnCreateOrder($filter: ModelSubscriptionOrderFilterInput) {
    onCreateOrder(filter: $filter) {
      id
      recipientName
      recipientNumber
      orderDetails
      parcelOrigin
      parcelOriginLat
      parcelOriginLng
      parcelDestination
      parcelDestinationLat
      parcelDestinationLng
      transportationType
      status
      price
      courierFee
      Courier {
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
        courierBVN
        bankName
        accountName
        accountNumber
        transportationType
        vehicleType
        model
        plateNumber
        maxiImages
        maxiTransportPrice
        guarantorName
        guarantorLastName
        guarantorProfession
        guarantorNumber
        guarantorRelationship
        guarantorAddress
        guarantorEmail
        guarantorNIN
        lat
        lng
        heading
        push_token
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      userID
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      orderCourierId
      __typename
    }
  }
`;
export const onUpdateOrder = /* GraphQL */ `
  subscription OnUpdateOrder($filter: ModelSubscriptionOrderFilterInput) {
    onUpdateOrder(filter: $filter) {
      id
      recipientName
      recipientNumber
      orderDetails
      parcelOrigin
      parcelOriginLat
      parcelOriginLng
      parcelDestination
      parcelDestinationLat
      parcelDestinationLng
      transportationType
      status
      price
      courierFee
      Courier {
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
        courierBVN
        bankName
        accountName
        accountNumber
        transportationType
        vehicleType
        model
        plateNumber
        maxiImages
        maxiTransportPrice
        guarantorName
        guarantorLastName
        guarantorProfession
        guarantorNumber
        guarantorRelationship
        guarantorAddress
        guarantorEmail
        guarantorNIN
        lat
        lng
        heading
        push_token
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      userID
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      orderCourierId
      __typename
    }
  }
`;
export const onDeleteOrder = /* GraphQL */ `
  subscription OnDeleteOrder($filter: ModelSubscriptionOrderFilterInput) {
    onDeleteOrder(filter: $filter) {
      id
      recipientName
      recipientNumber
      orderDetails
      parcelOrigin
      parcelOriginLat
      parcelOriginLng
      parcelDestination
      parcelDestinationLat
      parcelDestinationLng
      transportationType
      status
      price
      courierFee
      Courier {
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
        courierBVN
        bankName
        accountName
        accountNumber
        transportationType
        vehicleType
        model
        plateNumber
        maxiImages
        maxiTransportPrice
        guarantorName
        guarantorLastName
        guarantorProfession
        guarantorNumber
        guarantorRelationship
        guarantorAddress
        guarantorEmail
        guarantorNIN
        lat
        lng
        heading
        push_token
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        __typename
      }
      userID
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      orderCourierId
      __typename
    }
  }
`;
export const onCreateCourier = /* GraphQL */ `
  subscription OnCreateCourier($filter: ModelSubscriptionCourierFilterInput) {
    onCreateCourier(filter: $filter) {
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
      courierBVN
      bankName
      accountName
      accountNumber
      transportationType
      vehicleType
      model
      plateNumber
      maxiImages
      maxiTransportPrice
      guarantorName
      guarantorLastName
      guarantorProfession
      guarantorNumber
      guarantorRelationship
      guarantorAddress
      guarantorEmail
      guarantorNIN
      lat
      lng
      heading
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
export const onUpdateCourier = /* GraphQL */ `
  subscription OnUpdateCourier($filter: ModelSubscriptionCourierFilterInput) {
    onUpdateCourier(filter: $filter) {
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
      courierBVN
      bankName
      accountName
      accountNumber
      transportationType
      vehicleType
      model
      plateNumber
      maxiImages
      maxiTransportPrice
      guarantorName
      guarantorLastName
      guarantorProfession
      guarantorNumber
      guarantorRelationship
      guarantorAddress
      guarantorEmail
      guarantorNIN
      lat
      lng
      heading
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
export const onDeleteCourier = /* GraphQL */ `
  subscription OnDeleteCourier($filter: ModelSubscriptionCourierFilterInput) {
    onDeleteCourier(filter: $filter) {
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
      courierBVN
      bankName
      accountName
      accountNumber
      transportationType
      vehicleType
      model
      plateNumber
      maxiImages
      maxiTransportPrice
      guarantorName
      guarantorLastName
      guarantorProfession
      guarantorNumber
      guarantorRelationship
      guarantorAddress
      guarantorEmail
      guarantorNIN
      lat
      lng
      heading
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
export const onCreateUser = /* GraphQL */ `
  subscription OnCreateUser($filter: ModelSubscriptionUserFilterInput) {
    onCreateUser(filter: $filter) {
      id
      sub
      firstName
      lastName
      phoneNumber
      profilePic
      address
      exactAddress
      Orders {
        nextToken
        startedAt
        __typename
      }
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
  }
`;
export const onUpdateUser = /* GraphQL */ `
  subscription OnUpdateUser($filter: ModelSubscriptionUserFilterInput) {
    onUpdateUser(filter: $filter) {
      id
      sub
      firstName
      lastName
      phoneNumber
      profilePic
      address
      exactAddress
      Orders {
        nextToken
        startedAt
        __typename
      }
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
  }
`;
export const onDeleteUser = /* GraphQL */ `
  subscription OnDeleteUser($filter: ModelSubscriptionUserFilterInput) {
    onDeleteUser(filter: $filter) {
      id
      sub
      firstName
      lastName
      phoneNumber
      profilePic
      address
      exactAddress
      Orders {
        nextToken
        startedAt
        __typename
      }
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
  }
`;
