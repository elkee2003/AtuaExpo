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
export const createOrder = /* GraphQL */ `
  mutation CreateOrder(
    $input: CreateOrderInput!
    $condition: ModelOrderConditionInput
  ) {
    createOrder(input: $input, condition: $condition) {
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
      userID
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
export const updateOrder = /* GraphQL */ `
  mutation UpdateOrder(
    $input: UpdateOrderInput!
    $condition: ModelOrderConditionInput
  ) {
    updateOrder(input: $input, condition: $condition) {
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
      userID
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
export const deleteOrder = /* GraphQL */ `
  mutation DeleteOrder(
    $input: DeleteOrderInput!
    $condition: ModelOrderConditionInput
  ) {
    deleteOrder(input: $input, condition: $condition) {
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
      userID
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
