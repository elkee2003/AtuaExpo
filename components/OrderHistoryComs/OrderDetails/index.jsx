import {
    ActivityIndicator,
    Image,
    Modal,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { Courier, Order } from "@/src/models";
import { DataStore } from "aws-amplify/datastore";
import { getUrl } from "aws-amplify/storage";
import { useEffect, useState } from "react";

import Collapsible from "react-native-collapsible";
import MapView, { Marker } from "react-native-maps";
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

  const [sections, setSections] = useState({
    route: true,
    pricing: false,
    load: false,
    evidence: false,
  });

  useEffect(() => {
    fetchOrder();
  }, []);

  //   Load Courier Image
  const loadCourierImage = async (courier) => {
    if (!courier?.profilePic) return;

    try {
      const url = await getUrl({ path: courier.profilePic });
      setProfileImage(url.url);
    } catch (e) {
      console.log(e);
    }
  };

  //   Fetch Order
  const fetchOrder = async () => {
    try {
      const orderData = await DataStore.query(Order, orderId);
      setOrder(orderData);

      if (orderData?.Courier?.id) {
        const courierData = await DataStore.query(
          Courier,
          orderData.Courier.id,
        );
        setCourier(courierData);

        if (courierData?.profilePic) {
          loadCourierImage(courierData);
        }
      }

      loadEvidence(orderData);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const loadEvidence = async (order) => {
    try {
      const groups = [
        order?.senderPreTransferPhotos,
        order?.courierPreTransferPhotos,
        order?.courierPostLoadingPhotos,
        order?.dropoffArrivalPhotos,
        order?.postDeliveryPhotos,
      ];

      const allImages = groups.flat().filter(Boolean);

      const urls = await Promise.all(
        allImages.map(async (img) => {
          const url = await getUrl({ path: img });
          return { uri: url.url };
        }),
      );

      setEvidence(urls);
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

  const reorder = () => {
    router.push({
      pathname: "/screens/createOrder",
      params: { reorderId: order.id },
    });
  };

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

      {courier && (
        <View style={styles.courierCard}>
          <Image
            source={profileImage ? { uri: profileImage } : Placeholder}
            defaultSource={Placeholder}
            style={styles.avatar}
          />

          <View style={{ flex: 1 }}>
            <Text style={styles.courierName}>
              {courier.firstName} {courier.lastName}
            </Text>

            <Text style={styles.vehicle}>
              {courier.vehicleClass} • {courier.plateNumber}
            </Text>
          </View>

          <TouchableOpacity style={styles.contactButton}>
            <Text style={{ color: "#fff" }}>Call</Text>
          </TouchableOpacity>
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

      <Section
        title="Route"
        open={sections.route}
        toggle={() => toggleSection("route")}
      >
        <Text>Pickup: {order.originAddress}</Text>
        <Text>Dropoff: {order.destinationAddress}</Text>
      </Section>

      <Section
        title="Load Details"
        open={sections.load}
        toggle={() => toggleSection("load")}
      >
        <Text>Category: {order.loadCategory}</Text>
        <Text>Weight: {order.declaredWeightBracket}</Text>
        <Text>Details: {order.orderDetails}</Text>
      </Section>

      <Section
        title="Price Breakdown"
        open={sections.pricing}
        toggle={() => toggleSection("pricing")}
      >
        <Text>Offer: ₦{order.initialOfferPrice}</Text>
        <Text>Loading Fee: ₦{order.loadingFee}</Text>
        <Text>Unloading Fee: ₦{order.unloadingFee}</Text>

        <Text style={styles.total}>
          Total: ₦{order.totalPrice?.toLocaleString()}
        </Text>
      </Section>

      {evidence.length > 0 && (
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

        {(order.status === "ACCEPTED" || order.status === "IN_TRANSIT") && (
          <>
            <Button
              title="Track Order"
              onPress={() =>
                router.push(`/screens/orderTrackingScreen/${order.id}`)
              }
            />
            <Button title="Contact Courier" type="outline" />
          </>
        )}

        {order.status === "DELIVERED" && (
          <>
            <Button title="Report Issue" />
            <Button title="Reorder" onPress={reorder} type="outline" />
          </>
        )}
      </View>

      <Modal visible={showViewer} transparent>
        <View style={styles.viewerContainer}>
          <TouchableOpacity
            style={styles.close}
            onPress={() => setShowViewer(false)}
          >
            <Text style={{ color: "#fff", fontSize: 20 }}>✕</Text>
          </TouchableOpacity>

          <PagerView style={styles.viewerPager} initialPage={selectedImage}>
            {evidence.map((img, i) => (
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
          {value ? new Date(value).toLocaleString() : "-"}
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
