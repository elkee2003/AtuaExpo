import { Order } from "@/src/models";
import { DataStore } from "aws-amplify/datastore";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import styles from "./styles";

const RetryUploadBanner = ({ order }) => {
  const [loading, setLoading] = useState(false);
  const retryUpload = async () => {
    try {
      setLoading(true);

      await DataStore.save(
        Order.copyOf(order, (updated) => {
          updated.mediaUploadStatus = "UPLOADING";
        }),
      );

      await uploadMedia(order);

      await DataStore.save(
        Order.copyOf(order, (updated) => {
          updated.mediaUploadStatus = "COMPLETE";
        }),
      );
    } catch (error) {
      await DataStore.save(
        Order.copyOf(order, (updated) => {
          updated.mediaUploadStatus = "FAILED";
        }),
      );
    }

    setLoading(false);
  };

  return (
    <View style={styles.retryBanner}>
      <Text style={styles.retryText}>Upload failed. Please retry.</Text>

      <TouchableOpacity
        style={styles.retryButton}
        onPress={retryUpload}
        disabled={loading}
      >
        <Text style={styles.retryButtonText}>
          {loading ? "Retrying..." : "Retry Upload"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default RetryUploadBanner;
