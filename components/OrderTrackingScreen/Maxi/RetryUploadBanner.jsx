import { uploadEvidence } from "@/utils/uploadEvidence";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import styles from "./styles";

const RetryUploadBanner = ({ order }) => {
  const [loading, setLoading] = useState(false);

  const retryUpload = async () => {
    try {
      setLoading(true);

      const photos =
        order.senderPreTransferLocalPhotos?.map((uri) => ({ uri })) || [];

      const video = order.senderPreTransferLocalVideo
        ? { uri: order.senderPreTransferLocalVideo }
        : null;

      await uploadEvidence(order, photos, video);
    } catch (error) {
      console.log("Retry upload failed:", error);
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
