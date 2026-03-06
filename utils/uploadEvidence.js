import { MediaUploadStatus, Order } from "@/src/models";
import { DataStore } from "aws-amplify/datastore";
import { uploadData } from "aws-amplify/storage";
import * as Crypto from "expo-crypto";
import * as ImageManipulator from "expo-image-manipulator";

export const uploadSenderPhotos = async (photos, userId) => {
  if (!photos?.length) return [];

  const uploaded = [];

  for (const photo of photos) {
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 900 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );

      const response = await fetch(manipulated.uri);
      const blob = await response.blob();

      const key = `public/orders/${userId}/senderPreTransferPhotos/${Crypto.randomUUID()}.jpg`;

      const result = await uploadData({
        path: key,
        data: blob,
        options: { contentType: "image/jpeg" },
      }).result;

      uploaded.push(result.path);
    } catch (err) {
      console.log("Photo upload failed:", err);
    }
  }

  return uploaded;
};

export const uploadSenderVideo = async (video, userId) => {
  if (!video?.uri) return null;

  try {
    const response = await fetch(video.uri);
    const blob = await response.blob();

    const key = `public/orders/${userId}/senderPreTransferVideo/${Crypto.randomUUID()}.mp4`;

    const result = await uploadData({
      path: key,
      data: blob,
      options: { contentType: "video/mp4" },
    }).result;

    return result.path;
  } catch (err) {
    console.log("Video upload failed:", err);
    return null;
  }
};

export const uploadEvidence = async (order, photos, video) => {
  try {
    await DataStore.save(
      Order.copyOf(order, (updated) => {
        updated.mediaUploadStatus = MediaUploadStatus.UPLOADING;
      }),
    );
    // on the drivers side do it in such a way driver sees "Sender evidence uploading... ". An example:
    // if mediaUploadStatus === PENDING
    //    "Preparing sender evidence..."

    // if mediaUploadStatus === UPLOADING
    //    "Sender evidence uploading..."

    // if mediaUploadStatus === COMPLETE
    //    show photos + video

    // if mediaUploadStatus === FAILED
    //    "Sender evidence failed to upload"

    const [uploadedPhotos, uploadedVideo] = await Promise.all([
      uploadSenderPhotos(photos, order.userID),
      uploadSenderVideo(video, order.userID),
    ]);

    await DataStore.save(
      Order.copyOf(order, (updated) => {
        updated.senderPreTransferPhotos = uploadedPhotos;
        updated.senderPreTransferVideo = uploadedVideo;

        // remove local paths after upload
        updated.senderPreTransferLocalPhotos = null;
        updated.senderPreTransferLocalVideo = null;

        updated.mediaUploadStatus = MediaUploadStatus.COMPLETE;
      }),
    );

    console.log("Evidence upload complete");
  } catch (error) {
    console.log("Evidence upload error", error);

    await DataStore.save(
      Order.copyOf(order, (updated) => {
        updated.mediaUploadStatus = MediaUploadStatus.FAILED;
      }),
    );
  }
};
