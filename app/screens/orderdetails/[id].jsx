import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import OrderDetails from "../../../components/OrderHistoryComs/OrderDetails";

const OrderDetailsScreen = () => {
  const { id } = useLocalSearchParams();

  return (
    <View style={{ flex: 1 }}>
      <OrderDetails orderId={id} />
    </View>
  );
};

export default OrderDetailsScreen;
