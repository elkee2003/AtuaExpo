import { Courier, Order } from "@/src/models";
import { DataStore } from "aws-amplify/datastore";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import OrderLiveUpdateCom from "../../../components/OrderLiveUpdate";

const OrderLiveUpdate = () => {
  const [courier, setCourier] = useState([]);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const { id } = useLocalSearchParams();

  const fetchTrackedOrder = async (id) => {
    setLoading(true);
    try {
      if (id) {
        const trackedOrder = await DataStore.query(Order, id);

        setOrder(trackedOrder);

        if (trackedOrder) {
          // Fetch the Courier realted to the Order
          const trackedCourier = await DataStore.query(
            Courier,
            trackedOrder.assignedCourierId,
          );
          setCourier(trackedCourier);
        }
      }
    } catch (e) {
      console.error("Error Fetching Order", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackedOrder(id);
  }, [id]);

  // useEffect to update Order
  useEffect(() => {
    if (!order) {
      return;
    }

    const subscription = DataStore.observe(Order, order.id).subscribe(
      ({ opType, element }) => {
        if (opType === "UPDATE") {
          setOrder(element);
        }
      },
    );

    return () => subscription.unsubscribe;
  }, [order]);

  // useEffect to update Courier
  useEffect(() => {
    if (!courier) {
      return;
    }

    const subscription = DataStore.observe(Courier, courier.id).subscribe(
      ({ opType, element }) => {
        if (opType === "UPDATE") {
          setCourier(element);
        }
      },
    );

    return () => subscription.unsubscribe;
  }, [courier.id]);

  if (!order || !courier) {
    return (
      <View
        style={{ top: "50%", justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator size="large" color="#3cff00" />
      </View>
    );
  }

  if (loading) {
    return (
      <View
        style={{ top: "10%", justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator size="large" color="#3cff00" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <OrderLiveUpdateCom order={order} courier={courier} />
    </View>
  );
};

export default OrderLiveUpdate;
