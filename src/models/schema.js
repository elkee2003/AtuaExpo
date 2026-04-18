export const schema = {
    "models": {
        "CompanyVehicle": {
            "name": "CompanyVehicle",
            "fields": {
                "id": {
                    "name": "id",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "vehicleType": {
                    "name": "vehicleType",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "model": {
                    "name": "model",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "plateNumber": {
                    "name": "plateNumber",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "couriercompanyID": {
                    "name": "couriercompanyID",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "createdAt": {
                    "name": "createdAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                },
                "updatedAt": {
                    "name": "updatedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                }
            },
            "syncable": true,
            "pluralName": "CompanyVehicles",
            "attributes": [
                {
                    "type": "model",
                    "properties": {}
                },
                {
                    "type": "key",
                    "properties": {
                        "name": "byCourierCompany",
                        "fields": [
                            "couriercompanyID"
                        ]
                    }
                },
                {
                    "type": "auth",
                    "properties": {
                        "rules": [
                            {
                                "allow": "public",
                                "operations": [
                                    "create",
                                    "update",
                                    "delete",
                                    "read"
                                ]
                            }
                        ]
                    }
                }
            ]
        },
        "CourierCompany": {
            "name": "CourierCompany",
            "fields": {
                "id": {
                    "name": "id",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "sub": {
                    "name": "sub",
                    "isArray": false,
                    "type": "String",
                    "isRequired": true,
                    "attributes": []
                },
                "firstName": {
                    "name": "firstName",
                    "isArray": false,
                    "type": "String",
                    "isRequired": true,
                    "attributes": []
                },
                "lastName": {
                    "name": "lastName",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "profilePic": {
                    "name": "profilePic",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "address": {
                    "name": "address",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "lat": {
                    "name": "lat",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "lng": {
                    "name": "lng",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "landmark": {
                    "name": "landmark",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "phoneNumber": {
                    "name": "phoneNumber",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "email": {
                    "name": "email",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "adminFirstName": {
                    "name": "adminFirstName",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "adminLastName": {
                    "name": "adminLastName",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "adminPhoneNumber": {
                    "name": "adminPhoneNumber",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "bankName": {
                    "name": "bankName",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "CompanyVehicles": {
                    "name": "CompanyVehicles",
                    "isArray": true,
                    "type": {
                        "model": "CompanyVehicle"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true,
                    "association": {
                        "connectionType": "HAS_MANY",
                        "associatedWith": [
                            "couriercompanyID"
                        ]
                    }
                },
                "accountNumber": {
                    "name": "accountNumber",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "push_token": {
                    "name": "push_token",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "createdAt": {
                    "name": "createdAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                },
                "updatedAt": {
                    "name": "updatedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                }
            },
            "syncable": true,
            "pluralName": "CourierCompanies",
            "attributes": [
                {
                    "type": "model",
                    "properties": {}
                },
                {
                    "type": "auth",
                    "properties": {
                        "rules": [
                            {
                                "allow": "public",
                                "operations": [
                                    "create",
                                    "update",
                                    "delete",
                                    "read"
                                ]
                            }
                        ]
                    }
                }
            ]
        },
        "Payout": {
            "name": "Payout",
            "fields": {
                "id": {
                    "name": "id",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "courierID": {
                    "name": "courierID",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "amount": {
                    "name": "amount",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": true,
                    "attributes": []
                },
                "status": {
                    "name": "status",
                    "isArray": false,
                    "type": {
                        "enum": "PayoutStatus"
                    },
                    "isRequired": false,
                    "attributes": []
                },
                "bankName": {
                    "name": "bankName",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "accountNumber": {
                    "name": "accountNumber",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "reference": {
                    "name": "reference",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "walletID": {
                    "name": "walletID",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": false,
                    "attributes": []
                },
                "createdAt": {
                    "name": "createdAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                },
                "updatedAt": {
                    "name": "updatedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                }
            },
            "syncable": true,
            "pluralName": "Payouts",
            "attributes": [
                {
                    "type": "model",
                    "properties": {}
                },
                {
                    "type": "key",
                    "properties": {
                        "name": "byCourier",
                        "fields": [
                            "courierID"
                        ]
                    }
                },
                {
                    "type": "key",
                    "properties": {
                        "name": "byWallet",
                        "fields": [
                            "walletID"
                        ]
                    }
                },
                {
                    "type": "auth",
                    "properties": {
                        "rules": [
                            {
                                "allow": "public",
                                "operations": [
                                    "create",
                                    "update",
                                    "delete",
                                    "read"
                                ]
                            }
                        ]
                    }
                }
            ]
        },
        "Transaction": {
            "name": "Transaction",
            "fields": {
                "id": {
                    "name": "id",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "walletID": {
                    "name": "walletID",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "type": {
                    "name": "type",
                    "isArray": false,
                    "type": {
                        "enum": "TransactionType"
                    },
                    "isRequired": false,
                    "attributes": []
                },
                "amount": {
                    "name": "amount",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": true,
                    "attributes": []
                },
                "description": {
                    "name": "description",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "orderID": {
                    "name": "orderID",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": false,
                    "attributes": []
                },
                "paymentID": {
                    "name": "paymentID",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": false,
                    "attributes": []
                },
                "status": {
                    "name": "status",
                    "isArray": false,
                    "type": {
                        "enum": "TransactionStatus"
                    },
                    "isRequired": false,
                    "attributes": []
                },
                "createdAt": {
                    "name": "createdAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                },
                "updatedAt": {
                    "name": "updatedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                }
            },
            "syncable": true,
            "pluralName": "Transactions",
            "attributes": [
                {
                    "type": "model",
                    "properties": {}
                },
                {
                    "type": "key",
                    "properties": {
                        "name": "byWallet",
                        "fields": [
                            "walletID"
                        ]
                    }
                },
                {
                    "type": "key",
                    "properties": {
                        "name": "byOrder",
                        "fields": [
                            "orderID"
                        ]
                    }
                },
                {
                    "type": "key",
                    "properties": {
                        "name": "byPayment",
                        "fields": [
                            "paymentID"
                        ]
                    }
                },
                {
                    "type": "auth",
                    "properties": {
                        "rules": [
                            {
                                "allow": "public",
                                "operations": [
                                    "create",
                                    "update",
                                    "delete",
                                    "read"
                                ]
                            }
                        ]
                    }
                }
            ]
        },
        "Wallet": {
            "name": "Wallet",
            "fields": {
                "id": {
                    "name": "id",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "ownerID": {
                    "name": "ownerID",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "ownerType": {
                    "name": "ownerType",
                    "isArray": false,
                    "type": {
                        "enum": "OwnerType"
                    },
                    "isRequired": true,
                    "attributes": []
                },
                "balance": {
                    "name": "balance",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "pendingBalance": {
                    "name": "pendingBalance",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "totalEarnings": {
                    "name": "totalEarnings",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "transactions": {
                    "name": "transactions",
                    "isArray": true,
                    "type": {
                        "model": "Transaction"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true,
                    "association": {
                        "connectionType": "HAS_MANY",
                        "associatedWith": [
                            "walletID"
                        ]
                    }
                },
                "createdAt": {
                    "name": "createdAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                },
                "updatedAt": {
                    "name": "updatedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                }
            },
            "syncable": true,
            "pluralName": "Wallets",
            "attributes": [
                {
                    "type": "model",
                    "properties": {}
                },
                {
                    "type": "auth",
                    "properties": {
                        "rules": [
                            {
                                "allow": "public",
                                "operations": [
                                    "create",
                                    "update",
                                    "delete",
                                    "read"
                                ]
                            }
                        ]
                    }
                }
            ]
        },
        "Payment": {
            "name": "Payment",
            "fields": {
                "id": {
                    "name": "id",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "orderID": {
                    "name": "orderID",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "userID": {
                    "name": "userID",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "amount": {
                    "name": "amount",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": true,
                    "attributes": []
                },
                "currency": {
                    "name": "currency",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "status": {
                    "name": "status",
                    "isArray": false,
                    "type": {
                        "enum": "PaymentStatus"
                    },
                    "isRequired": false,
                    "attributes": []
                },
                "paymentMethod": {
                    "name": "paymentMethod",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "provider": {
                    "name": "provider",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "reference": {
                    "name": "reference",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "order": {
                    "name": "order",
                    "isArray": false,
                    "type": {
                        "model": "Order"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "association": {
                        "connectionType": "BELONGS_TO",
                        "targetNames": [
                            "orderID"
                        ]
                    }
                },
                "user": {
                    "name": "user",
                    "isArray": false,
                    "type": {
                        "model": "User"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "association": {
                        "connectionType": "BELONGS_TO",
                        "targetNames": [
                            "userID"
                        ]
                    }
                },
                "createdAt": {
                    "name": "createdAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                },
                "updatedAt": {
                    "name": "updatedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                }
            },
            "syncable": true,
            "pluralName": "Payments",
            "attributes": [
                {
                    "type": "model",
                    "properties": {}
                },
                {
                    "type": "key",
                    "properties": {
                        "name": "byOrder",
                        "fields": [
                            "orderID"
                        ]
                    }
                },
                {
                    "type": "key",
                    "properties": {
                        "name": "byUser",
                        "fields": [
                            "userID"
                        ]
                    }
                },
                {
                    "type": "auth",
                    "properties": {
                        "rules": [
                            {
                                "allow": "public",
                                "operations": [
                                    "create",
                                    "update",
                                    "delete",
                                    "read"
                                ]
                            }
                        ]
                    }
                }
            ]
        },
        "Offer": {
            "name": "Offer",
            "fields": {
                "id": {
                    "name": "id",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "orderID": {
                    "name": "orderID",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": false,
                    "attributes": []
                },
                "order": {
                    "name": "order",
                    "isArray": false,
                    "type": {
                        "model": "Order"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "association": {
                        "connectionType": "BELONGS_TO",
                        "targetNames": [
                            "orderID"
                        ]
                    }
                },
                "courierID": {
                    "name": "courierID",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": false,
                    "attributes": []
                },
                "courier": {
                    "name": "courier",
                    "isArray": false,
                    "type": {
                        "model": "Courier"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "association": {
                        "connectionType": "BELONGS_TO",
                        "targetNames": [
                            "courierID"
                        ]
                    }
                },
                "senderType": {
                    "name": "senderType",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "amount": {
                    "name": "amount",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "status": {
                    "name": "status",
                    "isArray": false,
                    "type": {
                        "enum": "OfferStatus"
                    },
                    "isRequired": false,
                    "attributes": []
                },
                "createdAt": {
                    "name": "createdAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                },
                "updatedAt": {
                    "name": "updatedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                }
            },
            "syncable": true,
            "pluralName": "Offers",
            "attributes": [
                {
                    "type": "model",
                    "properties": {}
                },
                {
                    "type": "key",
                    "properties": {
                        "name": "byOrder",
                        "fields": [
                            "orderID"
                        ]
                    }
                },
                {
                    "type": "key",
                    "properties": {
                        "name": "byCourier",
                        "fields": [
                            "courierID"
                        ]
                    }
                },
                {
                    "type": "auth",
                    "properties": {
                        "rules": [
                            {
                                "allow": "public",
                                "operations": [
                                    "create",
                                    "update",
                                    "delete",
                                    "read"
                                ]
                            }
                        ]
                    }
                }
            ]
        },
        "Order": {
            "name": "Order",
            "fields": {
                "id": {
                    "name": "id",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "recipientName": {
                    "name": "recipientName",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "recipientNumber": {
                    "name": "recipientNumber",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "recipientNumber2": {
                    "name": "recipientNumber2",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "orderDetails": {
                    "name": "orderDetails",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "originAddress": {
                    "name": "originAddress",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "originState": {
                    "name": "originState",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "originLat": {
                    "name": "originLat",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "originLng": {
                    "name": "originLng",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "destinationAddress": {
                    "name": "destinationAddress",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "destinationState": {
                    "name": "destinationState",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "destinationLat": {
                    "name": "destinationLat",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "destinationLng": {
                    "name": "destinationLng",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "tripType": {
                    "name": "tripType",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "distance": {
                    "name": "distance",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "transportationType": {
                    "name": "transportationType",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "vehicleClass": {
                    "name": "vehicleClass",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "status": {
                    "name": "status",
                    "isArray": false,
                    "type": {
                        "enum": "OrderStatus"
                    },
                    "isRequired": false,
                    "attributes": []
                },
                "hasNewOffer": {
                    "name": "hasNewOffer",
                    "isArray": false,
                    "type": "Boolean",
                    "isRequired": false,
                    "attributes": []
                },
                "lastOfferAt": {
                    "name": "lastOfferAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": []
                },
                "lastOfferSenderType": {
                    "name": "lastOfferSenderType",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "loadCategory": {
                    "name": "loadCategory",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "isInterState": {
                    "name": "isInterState",
                    "isArray": false,
                    "type": "Boolean",
                    "isRequired": false,
                    "attributes": []
                },
                "estimatedMinPrice": {
                    "name": "estimatedMinPrice",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "estimatedMaxPrice": {
                    "name": "estimatedMaxPrice",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "initialOfferPrice": {
                    "name": "initialOfferPrice",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "loadingFee": {
                    "name": "loadingFee",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "unloadingFee": {
                    "name": "unloadingFee",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "floorSurcharge": {
                    "name": "floorSurcharge",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "fragileSurcharge": {
                    "name": "fragileSurcharge",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "extrasTotal": {
                    "name": "extrasTotal",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "totalPrice": {
                    "name": "totalPrice",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "operationalFare": {
                    "name": "operationalFare",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "courierEarnings": {
                    "name": "courierEarnings",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "commissionAmount": {
                    "name": "commissionAmount",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "platformFee": {
                    "name": "platformFee",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "platformServiceRevenue": {
                    "name": "platformServiceRevenue",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "vatAmount": {
                    "name": "vatAmount",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "platformNetRevenue": {
                    "name": "platformNetRevenue",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "deliveryVerificationCode": {
                    "name": "deliveryVerificationCode",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "declaredWeightBracket": {
                    "name": "declaredWeightBracket",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "senderPreTransferPhotos": {
                    "name": "senderPreTransferPhotos",
                    "isArray": true,
                    "type": "String",
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true
                },
                "senderPreTransferVideo": {
                    "name": "senderPreTransferVideo",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "senderPreTransferRecordedAt": {
                    "name": "senderPreTransferRecordedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": []
                },
                "senderPreTransferLocalPhotos": {
                    "name": "senderPreTransferLocalPhotos",
                    "isArray": true,
                    "type": "String",
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true
                },
                "senderPreTransferLocalVideo": {
                    "name": "senderPreTransferLocalVideo",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "mediaUploadStatus": {
                    "name": "mediaUploadStatus",
                    "isArray": false,
                    "type": {
                        "enum": "MediaUploadStatus"
                    },
                    "isRequired": false,
                    "attributes": []
                },
                "courierPreTransferUploadStatus": {
                    "name": "courierPreTransferUploadStatus",
                    "isArray": false,
                    "type": {
                        "enum": "CourierPreTransferUploadStatus"
                    },
                    "isRequired": false,
                    "attributes": []
                },
                "courierPostLoadingUploadStatus": {
                    "name": "courierPostLoadingUploadStatus",
                    "isArray": false,
                    "type": {
                        "enum": "CourierPostLoadingUploadStatus"
                    },
                    "isRequired": false,
                    "attributes": []
                },
                "dropoffUploadStatus": {
                    "name": "dropoffUploadStatus",
                    "isArray": false,
                    "type": {
                        "enum": "DropoffUploadStatus"
                    },
                    "isRequired": false,
                    "attributes": []
                },
                "courierPreTransferPhotos": {
                    "name": "courierPreTransferPhotos",
                    "isArray": true,
                    "type": "String",
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true
                },
                "courierPreTransferVideo": {
                    "name": "courierPreTransferVideo",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "courierPreTransferRecordedAt": {
                    "name": "courierPreTransferRecordedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": []
                },
                "courierPreTransferLocalPhotos": {
                    "name": "courierPreTransferLocalPhotos",
                    "isArray": true,
                    "type": "String",
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true
                },
                "courierPreTransferLocalVideo": {
                    "name": "courierPreTransferLocalVideo",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "courierPostLoadingPhotos": {
                    "name": "courierPostLoadingPhotos",
                    "isArray": true,
                    "type": "String",
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true
                },
                "courierPostLoadingVideo": {
                    "name": "courierPostLoadingVideo",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "courierPostLoadingLocalPhotos": {
                    "name": "courierPostLoadingLocalPhotos",
                    "isArray": true,
                    "type": "String",
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true
                },
                "courierPostLoadingLocalVideo": {
                    "name": "courierPostLoadingLocalVideo",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "dropoffArrivalPhotos": {
                    "name": "dropoffArrivalPhotos",
                    "isArray": true,
                    "type": "String",
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true
                },
                "dropoffArrivalVideo": {
                    "name": "dropoffArrivalVideo",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "dropoffArrivalLocalPhotos": {
                    "name": "dropoffArrivalLocalPhotos",
                    "isArray": true,
                    "type": "String",
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true
                },
                "dropoffArrivalLocalVideo": {
                    "name": "dropoffArrivalLocalVideo",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "postDeliveryPhotos": {
                    "name": "postDeliveryPhotos",
                    "isArray": true,
                    "type": "String",
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true
                },
                "postDeliveryVideo": {
                    "name": "postDeliveryVideo",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "pickupLoadingResponsibility": {
                    "name": "pickupLoadingResponsibility",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "pickupFloorLevel": {
                    "name": "pickupFloorLevel",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "pickupFloorLevelPrice": {
                    "name": "pickupFloorLevelPrice",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "pickupHasElevator": {
                    "name": "pickupHasElevator",
                    "isArray": false,
                    "type": "Boolean",
                    "isRequired": false,
                    "attributes": []
                },
                "dropoffUnloadingResponsibility": {
                    "name": "dropoffUnloadingResponsibility",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "dropoffFloorLevel": {
                    "name": "dropoffFloorLevel",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "dropoffFloorLevelPrice": {
                    "name": "dropoffFloorLevelPrice",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "dropoffHasElevator": {
                    "name": "dropoffHasElevator",
                    "isArray": false,
                    "type": "Boolean",
                    "isRequired": false,
                    "attributes": []
                },
                "acceptedAt": {
                    "name": "acceptedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": []
                },
                "arrivedPickupAt": {
                    "name": "arrivedPickupAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": []
                },
                "loadingStartedAt": {
                    "name": "loadingStartedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": []
                },
                "tripStartedAt": {
                    "name": "tripStartedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": []
                },
                "arrivedDropoffAt": {
                    "name": "arrivedDropoffAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": []
                },
                "unloadingCompletedAt": {
                    "name": "unloadingCompletedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": []
                },
                "logisticsCompanyId": {
                    "name": "logisticsCompanyId",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": false,
                    "attributes": []
                },
                "waybillNumber": {
                    "name": "waybillNumber",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "waybillPhoto": {
                    "name": "waybillPhoto",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "logisticsTrackingCode": {
                    "name": "logisticsTrackingCode",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "logisticsTrackingStatus": {
                    "name": "logisticsTrackingStatus",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "handedOverToLogisticsAt": {
                    "name": "handedOverToLogisticsAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": []
                },
                "logisticsIntakeConfirmedAt": {
                    "name": "logisticsIntakeConfirmedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": []
                },
                "acceptedOfferID": {
                    "name": "acceptedOfferID",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": false,
                    "attributes": []
                },
                "paymentStatus": {
                    "name": "paymentStatus",
                    "isArray": false,
                    "type": {
                        "enum": "OrderPaymentStatus"
                    },
                    "isRequired": false,
                    "attributes": []
                },
                "paymentID": {
                    "name": "paymentID",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": false,
                    "attributes": []
                },
                "payoutStatus": {
                    "name": "payoutStatus",
                    "isArray": false,
                    "type": {
                        "enum": "OrderPayoutStatus"
                    },
                    "isRequired": false,
                    "attributes": []
                },
                "fundsStatus": {
                    "name": "fundsStatus",
                    "isArray": false,
                    "type": {
                        "enum": "FundsStatus"
                    },
                    "isRequired": false,
                    "attributes": []
                },
                "assignedCourierId": {
                    "name": "assignedCourierId",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": false,
                    "attributes": []
                },
                "assignmentExpiresAt": {
                    "name": "assignmentExpiresAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": []
                },
                "assignmentAttempts": {
                    "name": "assignmentAttempts",
                    "isArray": false,
                    "type": "Int",
                    "isRequired": false,
                    "attributes": []
                },
                "lastAssignedAt": {
                    "name": "lastAssignedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": []
                },
                "rejectedCourierIds": {
                    "name": "rejectedCourierIds",
                    "isArray": true,
                    "type": "ID",
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true
                },
                "assignmentStatus": {
                    "name": "assignmentStatus",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "userID": {
                    "name": "userID",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "offers": {
                    "name": "offers",
                    "isArray": true,
                    "type": {
                        "model": "Offer"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true,
                    "association": {
                        "connectionType": "HAS_MANY",
                        "associatedWith": [
                            "order"
                        ]
                    }
                },
                "assignedCourier": {
                    "name": "assignedCourier",
                    "isArray": false,
                    "type": {
                        "model": "Courier"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "association": {
                        "connectionType": "BELONGS_TO",
                        "targetNames": [
                            "assignedCourierId"
                        ]
                    }
                },
                "payments": {
                    "name": "payments",
                    "isArray": true,
                    "type": {
                        "model": "Payment"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true,
                    "association": {
                        "connectionType": "HAS_MANY",
                        "associatedWith": [
                            "order"
                        ]
                    }
                },
                "createdAt": {
                    "name": "createdAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                },
                "updatedAt": {
                    "name": "updatedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                }
            },
            "syncable": true,
            "pluralName": "Orders",
            "attributes": [
                {
                    "type": "model",
                    "properties": {}
                },
                {
                    "type": "key",
                    "properties": {
                        "name": "byAssignedCourier",
                        "fields": [
                            "assignedCourierId"
                        ]
                    }
                },
                {
                    "type": "key",
                    "properties": {
                        "name": "byAssignmentStatus",
                        "fields": [
                            "assignmentStatus",
                            "assignmentExpiresAt"
                        ]
                    }
                },
                {
                    "type": "key",
                    "properties": {
                        "name": "byUser",
                        "fields": [
                            "userID"
                        ]
                    }
                },
                {
                    "type": "auth",
                    "properties": {
                        "rules": [
                            {
                                "allow": "public",
                                "operations": [
                                    "create",
                                    "update",
                                    "delete",
                                    "read"
                                ]
                            }
                        ]
                    }
                }
            ]
        },
        "Courier": {
            "name": "Courier",
            "fields": {
                "id": {
                    "name": "id",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "sub": {
                    "name": "sub",
                    "isArray": false,
                    "type": "String",
                    "isRequired": true,
                    "attributes": []
                },
                "isOnline": {
                    "name": "isOnline",
                    "isArray": false,
                    "type": "Boolean",
                    "isRequired": false,
                    "attributes": []
                },
                "firstName": {
                    "name": "firstName",
                    "isArray": false,
                    "type": "String",
                    "isRequired": true,
                    "attributes": []
                },
                "lastName": {
                    "name": "lastName",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "profilePic": {
                    "name": "profilePic",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "address": {
                    "name": "address",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "landMark": {
                    "name": "landMark",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "phoneNumber": {
                    "name": "phoneNumber",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "email": {
                    "name": "email",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "courierNIN": {
                    "name": "courierNIN",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "courierNINImage": {
                    "name": "courierNINImage",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "bankCode": {
                    "name": "bankCode",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "bankName": {
                    "name": "bankName",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "accountName": {
                    "name": "accountName",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "accountNumber": {
                    "name": "accountNumber",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "transportationType": {
                    "name": "transportationType",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "vehicleClass": {
                    "name": "vehicleClass",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "model": {
                    "name": "model",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "vehicleColour": {
                    "name": "vehicleColour",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "plateNumber": {
                    "name": "plateNumber",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "maxiImages": {
                    "name": "maxiImages",
                    "isArray": true,
                    "type": "String",
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true
                },
                "maxiDescription": {
                    "name": "maxiDescription",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "guarantorName": {
                    "name": "guarantorName",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "guarantorLastName": {
                    "name": "guarantorLastName",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "guarantorProfession": {
                    "name": "guarantorProfession",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "guarantorNumber": {
                    "name": "guarantorNumber",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "guarantorRelationship": {
                    "name": "guarantorRelationship",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "guarantorAddress": {
                    "name": "guarantorAddress",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "guarantorEmail": {
                    "name": "guarantorEmail",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "guarantorNIN": {
                    "name": "guarantorNIN",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "guarantorNINImage": {
                    "name": "guarantorNINImage",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "lat": {
                    "name": "lat",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "lng": {
                    "name": "lng",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "heading": {
                    "name": "heading",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "push_token": {
                    "name": "push_token",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "isApproved": {
                    "name": "isApproved",
                    "isArray": false,
                    "type": "Boolean",
                    "isRequired": false,
                    "attributes": []
                },
                "approvedById": {
                    "name": "approvedById",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "currentBatchCount": {
                    "name": "currentBatchCount",
                    "isArray": false,
                    "type": "Int",
                    "isRequired": false,
                    "attributes": []
                },
                "currentExpressCount": {
                    "name": "currentExpressCount",
                    "isArray": false,
                    "type": "Int",
                    "isRequired": false,
                    "attributes": []
                },
                "currentMaxiCount": {
                    "name": "currentMaxiCount",
                    "isArray": false,
                    "type": "Int",
                    "isRequired": false,
                    "attributes": []
                },
                "lastBatchAssignedAt": {
                    "name": "lastBatchAssignedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": []
                },
                "statusKey": {
                    "name": "statusKey",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "offers": {
                    "name": "offers",
                    "isArray": true,
                    "type": {
                        "model": "Offer"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true,
                    "association": {
                        "connectionType": "HAS_MANY",
                        "associatedWith": [
                            "courier"
                        ]
                    }
                },
                "orders": {
                    "name": "orders",
                    "isArray": true,
                    "type": {
                        "model": "Order"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true,
                    "association": {
                        "connectionType": "HAS_MANY",
                        "associatedWith": [
                            "assignedCourier"
                        ]
                    }
                },
                "walletID": {
                    "name": "walletID",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": false,
                    "attributes": []
                },
                "wallet": {
                    "name": "wallet",
                    "isArray": false,
                    "type": {
                        "model": "Wallet"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "association": {
                        "connectionType": "HAS_ONE",
                        "associatedWith": [
                            "id"
                        ],
                        "targetNames": [
                            "walletID"
                        ]
                    }
                },
                "createdAt": {
                    "name": "createdAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                },
                "updatedAt": {
                    "name": "updatedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                }
            },
            "syncable": true,
            "pluralName": "Couriers",
            "attributes": [
                {
                    "type": "model",
                    "properties": {}
                },
                {
                    "type": "key",
                    "properties": {
                        "name": "byStatus",
                        "queryField": "couriersByStatus",
                        "fields": [
                            "statusKey"
                        ]
                    }
                },
                {
                    "type": "auth",
                    "properties": {
                        "rules": [
                            {
                                "allow": "public",
                                "operations": [
                                    "create",
                                    "update",
                                    "delete",
                                    "read"
                                ]
                            }
                        ]
                    }
                }
            ]
        },
        "User": {
            "name": "User",
            "fields": {
                "id": {
                    "name": "id",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "sub": {
                    "name": "sub",
                    "isArray": false,
                    "type": "String",
                    "isRequired": true,
                    "attributes": []
                },
                "firstName": {
                    "name": "firstName",
                    "isArray": false,
                    "type": "String",
                    "isRequired": true,
                    "attributes": []
                },
                "lastName": {
                    "name": "lastName",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "email": {
                    "name": "email",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "phoneNumber": {
                    "name": "phoneNumber",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "profilePic": {
                    "name": "profilePic",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "address": {
                    "name": "address",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "exactAddress": {
                    "name": "exactAddress",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "lat": {
                    "name": "lat",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "lng": {
                    "name": "lng",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "isBlocked": {
                    "name": "isBlocked",
                    "isArray": false,
                    "type": "Boolean",
                    "isRequired": false,
                    "attributes": []
                },
                "push_token": {
                    "name": "push_token",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "Orders": {
                    "name": "Orders",
                    "isArray": true,
                    "type": {
                        "model": "Order"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true,
                    "association": {
                        "connectionType": "HAS_MANY",
                        "associatedWith": [
                            "userID"
                        ]
                    }
                },
                "payments": {
                    "name": "payments",
                    "isArray": true,
                    "type": {
                        "model": "Payment"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true,
                    "association": {
                        "connectionType": "HAS_MANY",
                        "associatedWith": [
                            "user"
                        ]
                    }
                },
                "createdAt": {
                    "name": "createdAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                },
                "updatedAt": {
                    "name": "updatedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                }
            },
            "syncable": true,
            "pluralName": "Users",
            "attributes": [
                {
                    "type": "model",
                    "properties": {}
                },
                {
                    "type": "auth",
                    "properties": {
                        "rules": [
                            {
                                "allow": "public",
                                "operations": [
                                    "create",
                                    "update",
                                    "delete",
                                    "read"
                                ]
                            }
                        ]
                    }
                }
            ]
        }
    },
    "enums": {
        "FundsStatus": {
            "name": "FundsStatus",
            "values": [
                "HELD",
                "RELEASED"
            ]
        },
        "OrderPayoutStatus": {
            "name": "OrderPayoutStatus",
            "values": [
                "NOT_PAID",
                "PAID"
            ]
        },
        "OrderPaymentStatus": {
            "name": "OrderPaymentStatus",
            "values": [
                "PENDING",
                "PAID"
            ]
        },
        "PaymentStatus": {
            "name": "PaymentStatus",
            "values": [
                "PENDING",
                "SUCCESS",
                "FAILED"
            ]
        },
        "TransactionType": {
            "name": "TransactionType",
            "values": [
                "CREDIT",
                "DEBIT"
            ]
        },
        "TransactionStatus": {
            "name": "TransactionStatus",
            "values": [
                "PENDING",
                "COMPLETED",
                "FAILED"
            ]
        },
        "PayoutStatus": {
            "name": "PayoutStatus",
            "values": [
                "PENDING",
                "PROCESSING",
                "PAID",
                "FAILED"
            ]
        },
        "OwnerType": {
            "name": "OwnerType",
            "values": [
                "COURIER",
                "USER"
            ]
        },
        "OfferStatus": {
            "name": "OfferStatus",
            "values": [
                "ACTIVE",
                "ACCEPTED",
                "REJECTED"
            ]
        },
        "CourierPreTransferUploadStatus": {
            "name": "CourierPreTransferUploadStatus",
            "values": [
                "PENDING",
                "UPLOADING",
                "COMPLETE",
                "FAILED"
            ]
        },
        "CourierPostLoadingUploadStatus": {
            "name": "CourierPostLoadingUploadStatus",
            "values": [
                "PENDING",
                "UPLOADING",
                "COMPLETE",
                "FAILED"
            ]
        },
        "DropoffUploadStatus": {
            "name": "DropoffUploadStatus",
            "values": [
                "PENDING",
                "UPLOADING",
                "COMPLETE",
                "FAILED"
            ]
        },
        "MediaUploadStatus": {
            "name": "MediaUploadStatus",
            "values": [
                "PENDING",
                "UPLOADING",
                "COMPLETE",
                "FAILED"
            ]
        },
        "OrderStatus": {
            "name": "OrderStatus",
            "values": [
                "BIDDING",
                "READY_FOR_PICKUP",
                "ACCEPTED",
                "ARRIVED_PICKUP",
                "LOADING",
                "PICKED_UP",
                "IN_TRANSIT",
                "ARRIVED_DROPOFF",
                "UNLOADING",
                "DELIVERED",
                "HANDOVER_TO_LOGISTICS",
                "IN_LOGISTICS_TRANSIT",
                "CANCELLED",
                "DISPUTED"
            ]
        }
    },
    "nonModels": {},
    "codegenVersion": "3.4.4",
    "version": "8ef13fd786b603c985c31424dcfe685d"
};