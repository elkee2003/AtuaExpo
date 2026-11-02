import { Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

const OrderMap = ({ order, isDelivered, styles }) => {
  return (
    <View style={styles.mapContainer}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: (order.originLat + order.destinationLat) / 2,
          longitude: (order.originLng + order.destinationLng) / 2,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
        loadingEnabled
      >
        <Marker
          coordinate={{
            latitude: order.originLat,
            longitude: order.originLng,
          }}
          title="Pickup location"
          description={order.originAddress || ""}
        >
          <View style={styles.pickupMarker}>
            <View style={styles.pickupMarkerInner} />
          </View>
        </Marker>

        <Marker
          coordinate={{
            latitude: order.destinationLat,
            longitude: order.destinationLng,
          }}
          title="Dropoff location"
          description={order.destinationAddress || ""}
        >
          <View style={styles.dropoffMarker}>
            <Text style={styles.dropoffMarkerText}>●</Text>
          </View>
        </Marker>
      </MapView>

      <View style={styles.mapOverlayBadge}>
        <View style={styles.mapOverlayDot} />

        <Text style={styles.mapOverlayText}>
          {isDelivered ? "Delivered" : "Delivery route"}
        </Text>
      </View>
    </View>
  );
};

export default OrderMap;
