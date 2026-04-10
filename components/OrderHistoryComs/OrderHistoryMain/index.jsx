import { useAuthContext } from "@/providers/AuthProvider";
import { DataStore } from "aws-amplify/datastore";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Courier, Order } from "../../../src/models";
import OrderHistoryList from "../OrderHistoryList";
import styles from "./styles";

const OrderHistoryMain = () => {
  const { dbUser } = useAuthContext();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!dbUser?.id) return;

    try {
      setLoading(true);

      const userOrders = await DataStore.query(Order, (order) =>
        order.userID.eq(dbUser.id),
      );

      const sortedOrders = userOrders.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      const ordersWithCouriers = await Promise.all(
        sortedOrders.map(async (order) => {
          if (order.assignedCourierId && order.status !== "DELIVERED") {
            const courier = await DataStore.query(Courier, (c) =>
              c.id.eq(order.assignedCourierId),
            );
            return { ...order, courier: courier[0] || null };
          }
          return { ...order, courier: null };
        }),
      );

      setOrders(ordersWithCouriers);
    } catch (error) {
      console.log("Error fetching orders:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dbUser]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
  };

  useEffect(() => {
    fetchOrders();

    const subscription = DataStore.observe(Order).subscribe(() => {
      fetchOrders();
    });

    return () => subscription.unsubscribe();
  }, [fetchOrders]);

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
            renderItem={({ item }) => (
              <OrderHistoryList order={item} refreshOrders={fetchOrders} />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default OrderHistoryMain;
