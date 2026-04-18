import * as Clipboard from "expo-clipboard";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import MapView, { Marker } from "react-native-maps";

import { Order } from "@/src/models";
import { DataStore } from "aws-amplify/datastore";
import { getUrl } from "aws-amplify/storage";
import { useEffect, useState } from "react";

import Collapsible from "react-native-collapsible";
import PagerView from "react-native-pager-view";
import Placeholder from "../../../assets/images/placeholder.png";

import { router } from "expo-router";
import styles from "./styles";

const OrderDetails = ({ orderId }) => {
  const [order, setOrder] = useState(null);
  const [courier, setCourier] = useState(null);
  const [loading, setLoading] = useState(true);

  const [profileImage, setProfileImage] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [showViewer, setShowViewer] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  const hasValidCoords =
    typeof order?.originLat === "number" &&
    typeof order?.originLng === "number" &&
    typeof order?.destinationLat === "number" &&
    typeof order?.destinationLng === "number";

  const [sections, setSections] = useState({
    route: true,
    pricing: false,
    load: false,
    evidence: false,
    recipient: true,
  });

  // ✅ COPY FUNCTION (REUSABLE)
  const copyToClipboard = async (text, label = "Copied") => {
    if (!text) return;
    await Clipboard.setStringAsync(String(text));
    Alert.alert(label, "Copied to clipboard");
  };

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const orderData = await DataStore.query(Order, orderId);
        if (!isMounted) return;

        setOrder(orderData);

        // ✅ FIXED: use relationship instead of manual query
        if (orderData?.assignedCourierId) {
          const courierData = await orderData.assignedCourier;

          if (!isMounted) return;

          setCourier(courierData);

          if (courierData?.profilePic) {
            await loadCourierImage(courierData, isMounted);
          }
        }

        await loadEvidence(orderData, isMounted);
      } catch (e) {
        console.log(e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  //   Load Courier Image
  const loadCourierImage = async (courier, isMounted) => {
    if (!courier?.profilePic) return;

    try {
      const url = await getUrl({ path: courier.profilePic });
      if (isMounted) setProfileImage(url.url);
    } catch (e) {
      console.log(e);
    }
  };

  const loadEvidence = async (order, isMounted) => {
    try {
      const groups = [
        order?.senderPreTransferPhotos || [],
        order?.courierPreTransferPhotos || [],
        order?.courierPostLoadingPhotos || [],
        order?.dropoffArrivalPhotos || [],
        order?.postDeliveryPhotos || [],
      ];

      const urls = [];

      for (const img of groups.flat().filter(Boolean)) {
        const url = await getUrl({ path: img });
        urls.push({ uri: url.url });
      }

      if (isMounted) setEvidence(urls);
    } catch (e) {
      console.log(e);
    }
  };

  const toggleSection = (key) => {
    setSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // const reorder = () => {
  //   if (!order?.id) return;

  //   router.push({
  //     pathname: "/screens/createOrder",
  //     params: { reorderId: order.id },
  //   });
  // };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.loader}>
        <Text>Order not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Order #{order.id.slice(0, 6)}</Text>
        <Text style={styles.status}>{order.status}</Text>
      </View>

      {hasValidCoords && (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: order.originLat,
              longitude: order.originLng,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            <Marker
              coordinate={{
                latitude: order.originLat,
                longitude: order.originLng,
              }}
            />

            <Marker
              coordinate={{
                latitude: order.destinationLat,
                longitude: order.destinationLng,
              }}
            />
          </MapView>
        </View>
      )}

      {courier && (
        <View style={styles.courierCard}>
          <Image
            source={profileImage ? { uri: profileImage } : Placeholder}
            style={styles.avatar}
          />

          <View style={{ flex: 1 }}>
            <Text style={styles.courierName}>
              {courier.firstName} {courier.lastName}
            </Text>

            <Text style={styles.vehicle}>
              {courier.vehicleClass} • {courier.plateNumber}
            </Text>

            {/* ✅ PHONE + COPY */}
            {courier.phoneNumber && (
              <TouchableOpacity
                onPress={() =>
                  copyToClipboard(courier.phoneNumber, "Phone copied")
                }
              >
                <Text style={styles.copyText}>
                  Tap to copy: {courier.phoneNumber}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Delivery Timeline</Text>

        <TimelineItem label="Accepted" value={order.acceptedAt} />
        <TimelineItem label="Arrived Pickup" value={order.arrivedPickupAt} />
        <TimelineItem label="Trip Started" value={order.tripStartedAt} />
        <TimelineItem label="Arrived Dropoff" value={order.arrivedDropoffAt} />
        <TimelineItem label="Delivered" value={order.unloadingCompletedAt} />
      </View>

      {/* RECIPIENT DETAILS */}
      <Section
        title="Recipient Details"
        open={sections.recipient}
        toggle={() => toggleSection("recipient")}
      >
        <RowItem label="Name" value={order.recipientName} />
        <RowItem label="Phone" value={order.recipientNumber} />
        {order.recipientNumber2 && (
          <RowItem label="Alt Phone" value={order.recipientNumber2} />
        )}
      </Section>

      {/* ROUTE */}
      <Section
        title="Route"
        open={sections.route}
        toggle={() => toggleSection("route")}
      >
        <RowItem label="Pickup" value={order.originAddress} />
        <RowItem label="Dropoff" value={order.destinationAddress} />
        <RowItem label="Trip Type" value={order.tripType} />
      </Section>

      {/* PARCEL */}
      <Section
        title="Parcel Details"
        open={sections.load}
        toggle={() => toggleSection("load")}
      >
        <RowItem label="Category" value={order.loadCategory} />
        <RowItem label="Vehicle Class" value={order?.vehicleClass} />
        <RowItem label="Weight" value={order.declaredWeightBracket} />
        <RowItem label="Details" value={order.orderDetails} />

        <TouchableOpacity
          onPress={() =>
            copyToClipboard(order?.deliveryVerificationCode, "Code copied")
          }
        >
          <Text style={styles.copyText}>
            Code: {order.deliveryVerificationCode}
          </Text>
        </TouchableOpacity>
      </Section>

      {/* PRICE */}
      <Section
        title="Price Breakdown"
        open={sections.pricing}
        toggle={() => toggleSection("pricing")}
      >
        <RowItem
          label="Offer"
          value={
            order.initialOfferPrice
              ? `₦${order.initialOfferPrice.toLocaleString()}`
              : "-"
          }
        />
        <RowItem
          label="Operational Fare"
          value={order.operationalFare ? `₦${order.operationalFare}` : "-"}
        />
        <RowItem label="Loading" value={`₦${order.loadingFee}`} />
        <RowItem label="Unloading" value={`₦${order.unloadingFee}`} />
        <RowItem label="VAT" value={`₦${order.vatAmount}`} />

        <Text style={styles.total}>
          Total: ₦{order.totalPrice?.toLocaleString()}
        </Text>
      </Section>

      {evidence?.length > 0 && (
        <Section
          title="Delivery Evidence"
          open={sections.evidence}
          toggle={() => toggleSection("evidence")}
        >
          <ScrollView horizontal>
            {evidence.map((img, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  setSelectedImage(i);
                  setShowViewer(true);
                }}
              >
                <Image source={img} style={styles.evidence} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Section>
      )}

      <View style={styles.actions}>
        {order.status === "BIDDING" && (
          <>
            <Button title="View Bids" />
            <Button title="Cancel Order" type="outline" />
          </>
        )}

        {(order.status === "READY_FOR_PICKUP" ||
          order.status === "BIDDING" ||
          order.status === "ACCEPTED" ||
          order.status === "IN_TRANSIT") && (
          <>
            <Button
              title="Track Order"
              onPress={() =>
                router.push(`/screens/orderTrackingScreen/${order.id}`)
              }
            />
          </>
        )}

        {/* {order.status === "DELIVERED" && (
          <>
            <Button title="Report Issue" />
            <Button title="Reorder" onPress={reorder} type="outline" />
          </>
        )} */}
      </View>

      <Modal visible={showViewer} transparent>
        <View style={styles.viewerContainer}>
          <TouchableOpacity
            style={styles.close}
            onPress={() => setShowViewer(false)}
          >
            <Text style={{ color: "#fff", fontSize: 20 }}>✕</Text>
          </TouchableOpacity>

          <PagerView
            style={styles.viewerPager}
            initialPage={Math.min(selectedImage, evidence.length - 1)}
          >
            {evidence?.map((img, i) => (
              <View key={i} style={styles.viewerPage}>
                <Image
                  source={img}
                  style={styles.viewerImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </PagerView>
        </View>
      </Modal>
    </ScrollView>
  );
};

export default OrderDetails;

/* -------------------------------------------------------------------------- */
/* SUB COMPONENTS */
/* -------------------------------------------------------------------------- */

const TimelineItem = ({ label, value }) => {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineDot} />

      <View>
        <Text style={styles.timelineLabel}>{label}</Text>

        <Text style={styles.timelineTime}>
          {value
            ? new Date(value).toLocaleString([], {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "-"}
        </Text>
      </View>
    </View>
  );
};

const Section = ({ title, open, toggle, children }) => {
  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={toggle}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </TouchableOpacity>

      <Collapsible collapsed={!open}>{children}</Collapsible>
    </View>
  );
};

const RowItem = ({ label, value }) => {
  if (value === null || value === undefined) return null;

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
};

const Button = ({ title, onPress, type }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, type === "outline" && styles.outlineButton]}
    >
      <Text
        style={[styles.buttonText, type === "outline" && { color: "#111" }]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};
