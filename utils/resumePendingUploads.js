import { MediaUploadStatus, Order } from "@/src/models";
import { DataStore } from "aws-amplify/datastore";

let isRecovering = false;

export const resumePendingUploads = async (uploadEvidence) => {
  if (isRecovering) return;

  isRecovering = true;

  try {
    const statusesToRecover = [
      MediaUploadStatus.PENDING,
      MediaUploadStatus.FAILED,
      MediaUploadStatus.UPLOADING,
    ];

    const results = await Promise.all(
      statusesToRecover.map((status) =>
        DataStore.query(Order, (o) => o.mediaUploadStatus.eq(status)),
      ),
    );

    // Remove duplicates in case an order appears in multiple query results.
    const uniqueOrders = [
      ...new Map(results.flat().map((order) => [order.id, order])).values(),
    ];

    for (const order of uniqueOrders) {
      const photos =
        order.senderPreTransferLocalPhotos?.map((uri) => ({ uri })) || [];

      const video = order.senderPreTransferLocalVideo
        ? { uri: order.senderPreTransferLocalVideo }
        : null;

      // If local files are gone but uploaded references exist,
      // recover the status instead of uploading everything again.
      if (!photos.length && !video) {
        if (
          order.senderPreTransferPhotos?.length ||
          order.senderPreTransferVideo
        ) {
          const currentOrder =
            (await DataStore.query(Order, order.id)) || order;

          await DataStore.save(
            Order.copyOf(currentOrder, (updated) => {
              updated.mediaUploadStatus = MediaUploadStatus.COMPLETE;
            }),
          );
        } else {
          console.warn(
            "Cannot retry sender evidence: no local media paths found.",
            order.id,
          );
        }

        continue;
      }

      // Re-upload pending, failed, or interrupted uploads.
      await uploadEvidence(order, photos, video);
    }
  } catch (error) {
    console.error("Upload recovery error:", error);
  } finally {
    isRecovering = false;
  }
};
