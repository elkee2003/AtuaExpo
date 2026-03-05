import { useAuthContext } from "@/providers/AuthProvider";
import { useLocationContext } from "@/providers/LocationProvider";
import { useOrderContext } from "@/providers/OrderProvider";
import { Order } from "@/src/models";
import { DataStore } from "aws-amplify/datastore";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import MaxiReviewScreen from "../MaxiReviewCom";
import styles from "./styles";

const MaxiSubmit = () => {
  const { dbUser } = useAuthContext();
  const {
    originAddress,
    originLat,
    originLng,
    destinationAddress,
    destinationLat,
    destinationLng,
    lastDestination,
    originState,
    destinationState,
    totalMins,
    isInterState,
    tripType,
    totalKm,
    resetAllLocationFields,
  } = useLocationContext();

  const {
    recipientName,
    recipientNumber,
    recipientNumber2,
    orderDetails,
    transportationType,
    vehicleClass,
    orders,
    setOrders,
    estimatedMinPrice,
    estimatedMaxPrice,
    initialOfferPrice,
    loadingFee,
    unloadingFee,
    courierEarnings,
    commissionAmount,
    platformFee,
    deliveryVerificationCode,
    setDeliveryVerificationCode,
    loadCategory,
    declaredWeightBracket,
    senderPreTransferPhotos,
    senderPreTransferVideo,
    senderPreTransferRecordedAt,
    pickupLoadingResponsibility,
    pickupFloorLevel,
    pickupFloorLevelPrice,
    pickupHasElevator,
    dropoffUnloadingResponsibility,
    dropoffFloorLevel,
    dropoffFloorLevelPrice,
    dropoffHasElevator,
    removeOrder,
    createOrder,
    resetAllOrderFields,
  } = useOrderContext();

  // Function to generate verification code
  const generateVerificationCode = () => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);

    return (array[0] % 1000000).toString().padStart(6, "0");
  };

  const handleSubmit = async () => {
    try {
      if (
        initialOfferPrice < estimatedMinPrice ||
        initialOfferPrice > estimatedMaxPrice
      ) {
        Alert.alert(
          "Invalid Offer",
          "Your offer must be within the suggested range.",
        );
        return;
      }

      const verificationCode = generateVerificationCode();

      setDeliveryVerificationCode(verificationCode);

      const newOrder = await DataStore.save(
        new Order({
          // BASIC INFO
          recipientName,
          recipientNumber,
          recipientNumber2,
          orderDetails,

          originAddress: originAddress?.data?.description,
          originState,
          originLat: parseFloat(originLat),
          originLng: parseFloat(originLng),

          destinationAddress: destinationAddress?.data?.description,
          destinationState,
          destinationLat: parseFloat(destinationLat),
          destinationLng: parseFloat(destinationLng),

          tripType,
          distance: `${totalKm} km`,

          transportationType,
          vehicleClass,

          status: "READY_FOR_PICKUP",

          // PRICING
          loadCategory,
          isInterState,

          estimatedMinPrice: parseFloat(estimatedMinPrice),
          estimatedMaxPrice: parseFloat(estimatedMaxPrice),

          initialOfferPrice: parseFloat(initialOfferPrice),
          currentOfferPrice: parseFloat(initialOfferPrice),

          lastOfferBy: "USER",

          loadingFee: parseFloat(loadingFee),
          unloadingFee: parseFloat(unloadingFee),

          courierEarnings: parseFloat(courierEarnings),
          commissionAmount: parseFloat(commissionAmount),
          platformFee: parseFloat(platformFee),

          // VERIFICATION
          deliveryVerificationCode: verificationCode,

          // WEIGHT
          declaredWeightBracket,

          // LOADING
          pickupLoadingResponsibility,
          pickupFloorLevel,
          pickupFloorLevelPrice,
          pickupHasElevator,

          dropoffUnloadingResponsibility,
          dropoffFloorLevel,
          dropoffFloorLevelPrice,
          dropoffHasElevator,

          // RELATION
          userID: dbUser.id,
        }),
      );

      // ✅ Save order in context
      setOrders(newOrder);

      Alert.alert(
        "Success",
        `Order created. Verification Code: ${verificationCode}`,
      );

      resetAllOrderFields();
      resetAllLocationFields();
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <MaxiReviewScreen />

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitText}>Submit Maxi Request</Text>
      </TouchableOpacity>
    </View>
  );
};

export default MaxiSubmit;
