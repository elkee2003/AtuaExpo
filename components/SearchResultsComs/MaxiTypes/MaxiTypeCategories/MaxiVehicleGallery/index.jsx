import {
  ActivityIndicator,
  Animated,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Courier } from "@/src/models";
import { DataStore } from "aws-amplify/datastore";
import { getUrl } from "aws-amplify/storage";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { PinchGestureHandler, State } from "react-native-gesture-handler";
import PagerView from "react-native-pager-view";
import styles from "./styles";

export default function VehicleGallery() {
  const { vehicleClass } = useLocalSearchParams();

  const pagerRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(0);

  useEffect(() => {
    fetchCouriers();
  }, [vehicleClass]);

  const fetchCouriers = async () => {
    try {
      setLoading(true);
      setImages([]);
      setActivePage(0);

      const result = await DataStore.query(Courier, (c) =>
        c.vehicleClass.eq(vehicleClass),
      );

      // No courier found for this vehicle class
      if (result.length === 0) {
        console.log("No courier found for:", vehicleClass);
        return;
      }

      // Get images from the first matching courier
      const vehicleImages = result[0]?.maxiImages;

      console.log("Vehicle class:", vehicleClass);
      console.log("Courier found:", result[0]);
      console.log("maxiImages:", vehicleImages);

      // Courier exists but has no images
      if (
        !vehicleImages ||
        !Array.isArray(vehicleImages) ||
        vehicleImages.length === 0
      ) {
        console.log("No images available for:", vehicleClass);
        return;
      }

      const urls = [];

      for (const key of vehicleImages) {
        try {
          if (!key) {
            continue;
          }

          const res = await getUrl({
            path: key,
            options: {
              validateObjectExistence: true,
            },
          });

          if (res?.url) {
            urls.push(res.url.toString());
          }
        } catch (imageError) {
          console.log("Could not load image:", key, imageError);
        }
      }

      console.log("Valid image URLs:", urls);

      setImages(urls);
    } catch (error) {
      console.log("Error loading vehicles:", error);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  // Loading screen
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // No vehicles/images available
  if (images.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Text style={styles.emptyIconText}>🚚</Text>
        </View>

        <Text style={styles.emptyTitle}>No Vehicles Available</Text>

        <Text style={styles.emptyDescription}>
          There are currently no available vehicles in the{" "}
          {vehicleClass?.toString().replace(/_/g, " ")} category.
        </Text>
      </View>
    );
  }

  return (
    <Animated.ScrollView
      style={styles.container}
      scrollEventThrottle={16}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        {
          useNativeDriver: true,
        },
      )}
    >
      {/* PARALLAX HEADER */}

      <View style={styles.galleryWrapper}>
        <PagerView
          style={styles.pager}
          ref={pagerRef}
          initialPage={0}
          onPageSelected={(e) => setActivePage(e.nativeEvent.position)}
        >
          {images.map((img, index) => (
            <ZoomableImage key={index} uri={img} />
          ))}
        </PagerView>

        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.9)"]}
          style={styles.gradient}
        />
      </View>

      {/* PAGINATION */}

      <View style={styles.pagination}>
        {images.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              activePage === index && styles.activeDot,
            ]}
          />
        ))}
      </View>

      {/* FLOATING GLASS CARD */}

      <BlurView intensity={90} tint="dark" style={styles.infoCard}>
        <Text style={styles.title}>{vehicleClass}</Text>

        <Text style={styles.subtitle}>
          Premium logistics vehicle ready for deliveries
        </Text>

        <Text style={styles.description}>
          This vehicle class is optimized for heavy cargo and large shipments.
          Swipe through images to explore the vehicle.
        </Text>
      </BlurView>

      {/* THUMBNAILS */}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.thumbnailRow}
      >
        {images.map((img, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => pagerRef.current?.setPage(index)}
          >
            <Image
              source={{ uri: img }}
              style={[
                styles.thumbnail,
                activePage === index && styles.activeThumb,
              ]}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ height: 60 }} />
    </Animated.ScrollView>
  );
}

/* PINCH ZOOM IMAGE */

function ZoomableImage({ uri }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPinchEvent = Animated.event([{ nativeEvent: { scale } }], {
    useNativeDriver: true,
  });

  const onPinchStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <PinchGestureHandler
      onGestureEvent={onPinchEvent}
      onHandlerStateChange={onPinchStateChange}
    >
      <Animated.Image
        source={{ uri }}
        style={[
          styles.image,
          {
            transform: [{ scale }],
          },
        ]}
        resizeMode="cover"
      />
    </PinchGestureHandler>
  );
}
