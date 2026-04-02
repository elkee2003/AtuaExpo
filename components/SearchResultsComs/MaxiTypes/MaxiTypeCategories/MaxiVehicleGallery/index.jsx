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

  const [couriers, setCouriers] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(0);

  useEffect(() => {
    fetchCouriers();
  }, []);

  const fetchCouriers = async () => {
    try {
      const result = await DataStore.query(Courier, (c) =>
        c.vehicleClass.eq(vehicleClass),
      );

      setCouriers(result);

      if (result.length > 0) {
        const vehicleImages = result[0]?.maxiImages || [];

        const urls = await Promise.all(
          vehicleImages.map(async (key) => {
            const res = await getUrl({
              path: key,
              options: { validateObjectExistence: true },
            });

            return res.url.toString();
          }),
        );

        setImages(urls);
      }

      setLoading(false);
    } catch (error) {
      console.log("Error loading vehicles", error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <Animated.ScrollView
      style={styles.container}
      scrollEventThrottle={16}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true },
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
            onPress={() => pagerRef.current.setPage(index)}
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
        style={[styles.image, { transform: [{ scale }] }]}
        resizeMode="cover"
      />
    </PinchGestureHandler>
  );
}
