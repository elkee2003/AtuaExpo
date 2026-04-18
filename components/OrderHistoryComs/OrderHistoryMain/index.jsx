import { useAuthContext } from "@/providers/AuthProvider";
import { DataStore } from "aws-amplify/datastore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Order } from "../../../src/models";
import OrderHistoryList from "../OrderHistoryList";
import styles from "./styles";

const OrderHistoryMain = () => {
  const { dbUser } = useAuthContext();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!dbUser?.id) return;

    const subscription = DataStore.observeQuery(Order, (order) =>
      order.userID.eq(dbUser.id),
    ).subscribe(async ({ items }) => {
      try {
        // ✅ Sort orders
        const sortedOrders = items.sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime(),
        );

        // ✅ Attach courier using relationship (NO extra queries)
        const ordersWithCouriers = await Promise.all(
          sortedOrders.map(async (order) => {
            let courier = null;

            if (order.assignedCourierId && order.status !== "DELIVERED") {
              courier = await order.assignedCourier; // ✅ FIXED
            }

            return { ...order, courier };
          }),
        );

        setOrders(ordersWithCouriers);
      } catch (error) {
        console.log("Error processing orders:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [dbUser?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    // observeQuery auto-refreshes, so just stop loader
    setTimeout(() => setRefreshing(false), 500);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#0A0A0A" />
          <Text style={styles.loadingText}>Fetching your orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.header}>Order History</Text>
        <Text style={styles.subHeader}>
          Track your ongoing and completed deliveries
        </Text>

        {orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Orders Yet</Text>
            <Text style={styles.emptySub}>
              Once you place an order, it will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#0A0A0A"
              />
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => <OrderHistoryList order={item} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default OrderHistoryMain;
