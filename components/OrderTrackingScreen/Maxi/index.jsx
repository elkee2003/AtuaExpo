// components/maxi/MaxiBiddingSheet.js

import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import OfferCard from "./OfferCard";
import OfferCountdown from "./OfferCountdown";
import OfferHeader from "./OfferHeader";
import styles from "./styles";

const MaxiBiddingSheet = ({
  order,
  offers,
  notifiedDriversCount,
  onAcceptOffer,
  onCounterOffer,
  onCancel,
  expiresAt,
  bottomSheetRef,
}) => {
  const flatListRef = useRef(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [waitingCourierName, setWaitingCourierName] = useState("");
  const [counterAmount, setCounterAmount] = useState("");
  const [selectedOffer, setSelectedOffer] = useState(null);

  const latestOffer = offers[0];
  const latestOfferId = latestOffer?.offer?.id;

  const isAcceptDisabled =
    order?.status === "ACCEPTED" ||
    !latestOffer ||
    latestOffer?.offer?.senderType !== "COURIER";

  // useEffect for Waiting Logic
  useEffect(() => {
    if (isWaiting && latestOffer && latestOffer.senderType === "COURIER") {
      setIsWaiting(false);
    }
  }, [latestOffer, isWaiting]);

  // useEffect to scroll when offer updates
  useEffect(() => {
    if (offers.length > 0) {
      flatListRef.current?.scrollToOffset({
        offset: 0,
        animated: true,
      });
    }
  }, [offers]);

  // incase offers reset and isWaiting might stay stuck
  useEffect(() => {
    if (offers.length === 0) {
      setIsWaiting(false);
      setSelectedOffer(null);
    }
  }, [offers]);

  return (
    <View style={styles.container}>
      <OfferHeader
        offersCount={offers.length}
        notifiedDriversCount={notifiedDriversCount}
      />

      {offers.length === 0 && <OfferCountdown expiresAt={expiresAt} />}

      <FlatList
        ref={flatListRef}
        data={offers}
        keyExtractor={(item) => item.offer.id}
        renderItem={({ item }) => (
          <OfferCard
            offer={item.offer}
            courier={item.courier}
            isLatest={item.offer.id === latestOfferId}
            isAcceptDisabled={isAcceptDisabled}
            onAccept={() => {
              if (item.offer.id !== latestOfferId) return;
              onAcceptOffer(item.offer);
            }}
            onCounter={() => {
              if (item.offer.id !== latestOfferId) return;
              setSelectedOffer(item.offer);
              bottomSheetRef?.current?.expand();
            }}
          />
        )}
        contentContainerStyle={{ paddingBottom: 50 }}
      />

      {selectedOffer && (
        <View style={styles.inputContainer}>
          <TextInput
            value={counterAmount}
            onChangeText={setCounterAmount}
            editable={!isWaiting}
            keyboardType="numeric"
            placeholder="Enter counter offer"
            style={styles.input}
          />

          <TouchableOpacity
            style={[styles.sendBtn, isWaiting && styles.sendBtnDisabled]}
            disabled={isWaiting}
            onPress={() => {
              const num = Number(counterAmount);
              if (!num || num <= 0) return;

              const minPrice = order?.estimatedMinPrice;
              const maxPrice = order?.estimatedMaxPrice;

              if (num < minPrice || num > maxPrice) {
                alert(
                  `Offer must be between ₦${minPrice?.toLocaleString()} and ₦${maxPrice?.toLocaleString()}`,
                );
                return;
              }

              setWaitingCourierName(
                selectedOffer?.courier?.firstName || "Courier",
              );

              onCounterOffer({
                offerId: selectedOffer.id,
                orderID: selectedOffer.orderID,
                courierID: selectedOffer.courierID,
                amount: num,
              });

              setCounterAmount("");
              setSelectedOffer(null);
              setIsWaiting(true);
            }}
          >
            <Text style={styles.sendText}>Counter</Text>
          </TouchableOpacity>
        </View>
      )}
      {isWaiting && (
        <Text style={styles.waitingText}>
          Waiting for {waitingCourierName}...
        </Text>
      )}

      <Text
        style={styles.orderText}
        onPress={() => {
          router.push("/orderhistory");
        }}
      >
        Order History
      </Text>

      <Text style={styles.cancelText} onPress={onCancel}>
        Cancel Order
      </Text>
    </View>
  );
};

export default MaxiBiddingSheet;
