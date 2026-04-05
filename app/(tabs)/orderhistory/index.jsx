import { useAuthContext } from "@/providers/AuthProvider";
import { router } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";
import OrderHistoryMain from "../../../components/OrderHistoryComs/OrderHistoryMain";

const OrderHistory = () => {
  const { dbUser } = useAuthContext();

  useEffect(() => {
    if (!dbUser) {
      router.replace("/profile");
    }
  }, [dbUser]);

  if (!dbUser) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 20, fontWeight: "bold", color: "#afadad" }}>
          Kindly Fill in Your Data in Proile screen
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* <Text>Hello</Text> */}
      <OrderHistoryMain />
    </View>
  );
};

export default OrderHistory;
