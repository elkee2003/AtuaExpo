import { MediaUploadStatus, Order } from "@/src/models";
import { DataStore } from "aws-amplify/datastore";

export const resumePendingUploads = async (uploadEvidence) => {
  try {
    const pendingOrders = await DataStore.query(Order, (o) =>
      o.mediaUploadStatus.eq(MediaUploadStatus.PENDING),
    );

    const failedOrders = await DataStore.query(Order, (o) =>
      o.mediaUploadStatus.eq(MediaUploadStatus.FAILED),
    );

    const ordersToRetry = [...pendingOrders, ...failedOrders];

    for (const order of ordersToRetry) {
      const photos =
        order.senderPreTransferLocalPhotos?.map((uri) => ({ uri })) || [];

      const video = order.senderPreTransferLocalVideo
        ? { uri: order.senderPreTransferLocalVideo }
        : null;

      if (!photos.length && !video) continue;

      await uploadEvidence(order, photos, video);
    }
  } catch (err) {
    console.log("Upload recovery error:", err);
  }
};
