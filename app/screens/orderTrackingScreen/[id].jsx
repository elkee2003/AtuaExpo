import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import OrderTrackingScreenCom from "../../../components/OrderTrackingScreen";

const OrderTrackingScreen = () => {
  const { id } = useLocalSearchParams();

  return (
    <View style={{ flex: 1 }}>
      <OrderTrackingScreenCom orderId={id} />
    </View>
  );
};

export default OrderTrackingScreen;
