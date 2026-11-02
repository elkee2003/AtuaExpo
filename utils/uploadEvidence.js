import { MediaUploadStatus, Order } from "@/src/models";
import { DataStore } from "aws-amplify/datastore";
import { uploadData } from "aws-amplify/storage";
import * as Crypto from "expo-crypto";
import * as ImageManipulator from "expo-image-manipulator";

export const uploadSenderPhotos = async (photos, userId) => {
  if (!photos?.length) return [];

  const uploaded = [];

  for (const photo of photos) {
    if (!photo?.uri) {
      throw new Error("A sender photo is missing its local URI.");
    }

    const manipulated = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: 900 } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    const response = await fetch(manipulated.uri);

    if (!response.ok) {
      throw new Error(`Could not read sender photo: ${response.status}`);
    }

    const blob = await response.blob();

    const path = `public/orders/${userId}/senderPreTransferPhotos/${Crypto.randomUUID()}.jpg`;

    const result = await uploadData({
      path,
      data: blob,
      options: { contentType: "image/jpeg" },
    }).result;

    if (!result?.path) {
      throw new Error("Photo upload did not return a storage path.");
    }

    uploaded.push(result.path);
  }

  return uploaded;
};

export const uploadSenderVideo = async (video, userId) => {
  if (!video?.uri) return null;

  const response = await fetch(video.uri);

  if (!response.ok) {
    throw new Error(`Could not read sender video: ${response.status}`);
  }

  const blob = await response.blob();

  const path = `public/orders/${userId}/senderPreTransferVideo/${Crypto.randomUUID()}.mp4`;

  const result = await uploadData({
    path,
    data: blob,
    options: { contentType: "video/mp4" },
  }).result;

  if (!result?.path) {
    throw new Error("Video upload did not return a storage path.");
  }

  return result.path;
};

export const uploadEvidence = async (order, photos, video) => {
  try {
    const localPhotos = photos || [];
    const hasPhotos = localPhotos.length > 0;
    const hasVideo = Boolean(video?.uri);

    if (!hasPhotos && !hasVideo) {
      return true;
    }

    if (!order?.userID) {
      throw new Error("Order has no userID.");
    }

    // Always use the latest local DataStore version of the order.
    const latestOrder = (await DataStore.query(Order, order.id)) || order;

    await DataStore.save(
      Order.copyOf(latestOrder, (updated) => {
        updated.mediaUploadStatus = MediaUploadStatus.UPLOADING;
      }),
    );

    // Any failed photo or video upload must fail the whole operation.
    const [uploadedPhotos, uploadedVideo] = await Promise.all([
      uploadSenderPhotos(localPhotos, order.userID),
      uploadSenderVideo(video, order.userID),
    ]);

    if (uploadedPhotos.length !== localPhotos.length) {
      throw new Error("Not all sender photos were uploaded.");
    }

    if (hasVideo && !uploadedVideo) {
      throw new Error("The sender video was not uploaded.");
    }

    // Only mark COMPLETE after every requested upload succeeds.
    const currentOrder = (await DataStore.query(Order, order.id)) || order;

    await DataStore.save(
      Order.copyOf(currentOrder, (updated) => {
        updated.senderPreTransferPhotos = uploadedPhotos;
        updated.senderPreTransferVideo = uploadedVideo;

        updated.senderPreTransferLocalPhotos = null;
        updated.senderPreTransferLocalVideo = null;

        updated.mediaUploadStatus = MediaUploadStatus.COMPLETE;
      }),
    );

    console.log("Sender evidence upload complete:", order.id);

    return true;
  } catch (error) {
    console.error("Sender evidence upload failed:", order.id, error);

    // Preserve local media paths so the upload can be retried.
    try {
      const currentOrder = await DataStore.query(Order, order.id);

      if (currentOrder) {
        await DataStore.save(
          Order.copyOf(currentOrder, (updated) => {
            updated.mediaUploadStatus = MediaUploadStatus.FAILED;
          }),
        );
      }
    } catch (saveError) {
      console.error(
        "Could not save failed upload status:",
        order.id,
        saveError,
      );
    }

    return false;
  }
};
