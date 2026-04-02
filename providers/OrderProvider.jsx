import React, { createContext, useContext, useState } from "react";

const OrderContext = createContext({});

const OrderProvider = ({ children }) => {
  // BASIC INFO
  const [recipientName, setRecipientName] = useState("");
  const [recipientNumber, setRecipientNumber] = useState("");
  const [recipientNumber2, setRecipientNumber2] = useState("");
  const [orderDetails, setOrderDetails] = useState("");
  const [transportationType, setTransportationType] = useState("");
  const [vehicleClass, setVehicleClass] = useState("");
  const [orders, setOrders] = useState("");
  const [orderError, setOrderError] = useState("");

  // PRICING
  const [estimatedMinPrice, setEstimatedMinPrice] = useState(null);
  const [estimatedMaxPrice, setEstimatedMaxPrice] = useState(null);
  const [initialOfferPrice, setInitialOfferPrice] = useState(null);
  const [currentOfferPrice, setCurrentOfferPrice] = useState(null);
  const [lastOfferBy, setLastOfferBy] = useState("");
  const [loadingFee, setLoadingFee] = useState(null);
  const [unloadingFee, setUnloadingFee] = useState(null);
  const [totalPrice, setTotalPrice] = useState();
  const [operationalFare, setOperationalFare] = useState();
  const [courierEarnings, setCourierEarnings] = useState(null);
  const [commissionAmount, setCommissionAmount] = useState(null);
  const [platformFee, setPlatformFee] = useState(null);
  const [platformServiceRevenue, setPlatformServiceRevenue] = useState(null);
  const [vatAmount, setVatAmount] = useState(null);
  const [platformNetRevenue, setPlatformNetRevenue] = useState(null);

  // VERIFICATION
  const [deliveryVerificationCode, setDeliveryVerificationCode] = useState("");

  // WEIGHT
  const [loadCategory, setLoadCategory] = useState(null);
  const [declaredWeightBracket, setDeclaredWeightBracket] = useState("");

  // CUSTODY EVIDENCE
  const [senderPreTransferPhotos, setSenderPreTransferPhotos] = useState([]);
  const [senderPreTransferVideo, setSenderPreTransferVideo] = useState("");
  const [senderPreTransferRecordedAt, setSenderPreTransferRecordedAt] =
    useState("");
  const [courierPreTransferPhotos, setCourierPreTransferPhotos] = useState([]);
  const [courierPreTransferVideo, setCourierPreTransferVideo] = useState("");
  const [courierPreTransferRecordedAt, setCourierPreTransferRecordedAt] =
    useState("");
  const [dropoffArrivalPhotos, setDropoffArrivalPhotos] = useState([]);
  const [dropoffArrivalVideo, setDropoffArrivalVideo] = useState("");
  const [postDeliveryPhotos, setPostDeliveryPhotos] = useState([]);
  const [postDeliveryVideo, setPostDeliveryVideo] = useState("");

  // LOADING DETAILS
  const [pickupLoadingResponsibility, setPickupLoadingResponsibility] =
    useState("");
  const [pickupFloorLevel, setPickupFloorLevel] = useState("");
  const [pickupFloorLevelPrice, setPickupFloorLevelPrice] = useState(null);
  const [pickupHasElevator, setPickupHasElevator] = useState(false);
  const [dropoffUnloadingResponsibility, setDropoffUnloadingResponsibility] =
    useState("");
  const [dropoffFloorLevel, setDropoffFloorLevel] = useState("");
  const [dropoffFloorLevelPrice, setDropoffFloorLevelPrice] = useState(null);
  const [dropoffHasElevator, setDropoffHasElevator] = useState(false);

  // LOGISTICS COMPANY
  const [logisticsCompanyId, setLogisticsCompanyId] = useState("");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [waybillPhoto, setWaybillPhoto] = useState("");
  const [logisticsTrackingCode, setLogisticsTrackingCode] = useState("");
  const [logisticsTrackingStatus, setLogisticsTrackingStatus] = useState("");
  // const [handedOverToLogisticsAt, setHandedOverToLogisticsAt] = useState('');
  // const [logisticsIntakeConfirmedAt, setLogisticsIntakeConfirmedAt] = useState('');

  // Function to reset Micro and Moto
  const resetFreightFields = () => {
    setEstimatedMinPrice(null);
    setEstimatedMaxPrice(null);
    setInitialOfferPrice(null);
    setCurrentOfferPrice(null);
    setLastOfferBy("");
    setLoadingFee(null);
    setUnloadingFee(null);
    setPickupLoadingResponsibility("");
    setPickupFloorLevel("");
    setPickupFloorLevelPrice(null);
    setPickupHasElevator(false);
    setDropoffUnloadingResponsibility("");
    setDropoffFloorLevel("");
    setDropoffFloorLevelPrice(null);
    setDropoffHasElevator(false);
    setLoadCategory(null);
    setDeclaredWeightBracket("");
  };

  // Function to reset Maxi
  const resetInstantFields = () => {
    setTotalPrice(0);
    setCourierEarnings(null);
    setCommissionAmount(null);
    setPlatformFee(null);
    setPlatformServiceRevenue(null);
    setVatAmount(null);
    setPlatformNetRevenue(null);
  };

  // Function to reset based on transport type
  const resetOrderByTransportType = (type) => {
    if (type === "MAXI") {
      resetInstantFields();
    } else {
      resetFreightFields();
    }
  };

  // Function to reset all fields:
  const resetAllOrderFields = () => {
    // BASIC INFO
    setRecipientName("");
    setRecipientNumber("");
    setRecipientNumber2("");
    setOrderDetails("");
    setTransportationType("");
    setVehicleClass("");
    setOrders("");
    setOrderError("");

    // PRICING
    setEstimatedMinPrice(null);
    setEstimatedMaxPrice(null);
    setInitialOfferPrice(null);
    setCurrentOfferPrice(null);
    setLastOfferBy("");
    setLoadingFee(null);
    setUnloadingFee(null);
    setOperationalFare(null);
    setTotalPrice(null);
    setCourierEarnings(null);
    setCommissionAmount(null);
    setPlatformFee(null);
    setPlatformServiceRevenue(null);
    setVatAmount(null);
    setPlatformNetRevenue(null);

    // VERIFICATION
    setDeliveryVerificationCode("");

    // WEIGHT
    setLoadCategory(null);
    setDeclaredWeightBracket("");

    // CUSTODY
    setSenderPreTransferPhotos([]);
    setSenderPreTransferVideo("");
    setSenderPreTransferRecordedAt("");
    setCourierPreTransferPhotos([]);
    setCourierPreTransferVideo("");
    setCourierPreTransferRecordedAt("");
    setDropoffArrivalPhotos([]);
    setDropoffArrivalVideo("");
    setPostDeliveryPhotos([]);
    setPostDeliveryVideo("");

    // LOADING DETAILS
    setPickupLoadingResponsibility("");
    setPickupFloorLevel("");
    setPickupFloorLevelPrice(null);
    setPickupHasElevator(false);
    setDropoffUnloadingResponsibility("");
    setDropoffFloorLevel("");
    setDropoffFloorLevelPrice(null);
    setDropoffHasElevator(false);

    // LOGISTICS
    setLogisticsCompanyId("");
    setWaybillNumber("");
    setWaybillPhoto("");
    setLogisticsTrackingCode("");
    setLogisticsTrackingStatus("");
  };

  const removeOrder = [];

  const createOrder = [];

  return (
    <OrderContext.Provider
      value={{
        recipientName,
        recipientNumber,
        recipientNumber2,
        orderDetails,
        setRecipientName,
        setRecipientNumber,
        setRecipientNumber2,
        setOrderDetails,
        transportationType,
        setTransportationType,
        vehicleClass,
        setVehicleClass,
        orders,
        setOrders,
        estimatedMinPrice,
        setEstimatedMinPrice,
        estimatedMaxPrice,
        setEstimatedMaxPrice,
        initialOfferPrice,
        setInitialOfferPrice,
        currentOfferPrice,
        setCurrentOfferPrice,
        lastOfferBy,
        setLastOfferBy,
        loadingFee,
        setLoadingFee,
        unloadingFee,
        setUnloadingFee,
        operationalFare,
        setOperationalFare,
        totalPrice,
        setTotalPrice,
        courierEarnings,
        setCourierEarnings,
        commissionAmount,
        setCommissionAmount,
        platformFee,
        setPlatformFee,
        platformServiceRevenue,
        setPlatformServiceRevenue,
        vatAmount,
        setVatAmount,
        platformNetRevenue,
        setPlatformNetRevenue,
        deliveryVerificationCode,
        setDeliveryVerificationCode,
        loadCategory,
        setLoadCategory,
        declaredWeightBracket,
        setDeclaredWeightBracket,
        senderPreTransferPhotos,
        setSenderPreTransferPhotos,
        senderPreTransferVideo,
        setSenderPreTransferVideo,
        senderPreTransferRecordedAt,
        setSenderPreTransferRecordedAt,
        courierPreTransferPhotos,
        setCourierPreTransferPhotos,
        courierPreTransferVideo,
        setCourierPreTransferVideo,
        courierPreTransferRecordedAt,
        setCourierPreTransferRecordedAt,
        dropoffArrivalPhotos,
        setDropoffArrivalPhotos,
        dropoffArrivalVideo,
        setDropoffArrivalVideo,
        postDeliveryPhotos,
        setPostDeliveryPhotos,
        postDeliveryVideo,
        setPostDeliveryVideo,
        pickupLoadingResponsibility,
        setPickupLoadingResponsibility,
        pickupFloorLevel,
        setPickupFloorLevel,
        pickupFloorLevelPrice,
        setPickupFloorLevelPrice,
        pickupHasElevator,
        setPickupHasElevator,
        dropoffUnloadingResponsibility,
        setDropoffUnloadingResponsibility,
        dropoffFloorLevel,
        setDropoffFloorLevel,
        dropoffFloorLevelPrice,
        setDropoffFloorLevelPrice,
        dropoffHasElevator,
        setDropoffHasElevator,
        logisticsCompanyId,
        setLogisticsCompanyId,
        waybillNumber,
        setWaybillNumber,
        waybillPhoto,
        setWaybillPhoto,
        logisticsTrackingCode,
        setLogisticsTrackingCode,
        logisticsTrackingStatus,
        setLogisticsTrackingStatus,
        removeOrder,
        createOrder,
        orderError,
        setOrderError,
        resetOrderByTransportType,
        resetAllOrderFields,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

export default OrderProvider;

export const useOrderContext = () => useContext(OrderContext);
