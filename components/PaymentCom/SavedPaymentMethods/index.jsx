import Ionicons from "@expo/vector-icons/Ionicons";
import { DataStore } from "aws-amplify/datastore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { PaymentMethod } from "@/src/models";

import styles from "./styles";

//==================================================
// SAVED PAYMENT METHODS
//==================================================
//
// This component is responsible for:
//
// 1. Loading the user's saved payment methods.
// 2. Displaying safe card information only.
// 3. Allowing the user to select a saved card.
// 4. Allowing the user to delete a saved card.
// 5. Allowing the user to choose "Use a new card".
//
// IMPORTANT:
//
// This component does NOT complete the payment itself.
//
// Payment.jsx remains responsible for:
//
// - Calling chargeAtuaPaymentMethod.
// - Waiting for the Paystack webhook.
// - Waiting for the Order to synchronize through DataStore.
// - Confirming payment.
// - Navigating to Order Tracking.
//
// This keeps the payment lifecycle in one place.
//
//==================================================

const SavedPaymentMethods = ({
  onPayWithSavedCard,
  onUseNewCard,
  paymentLoading = false,
  selectedPaymentMethodId = null,
}) => {
  //================================================
  // STATE
  //================================================

  const [paymentMethods, setPaymentMethods] = useState([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [deletingPaymentMethodId, setDeletingPaymentMethodId] = useState(null);

  const [error, setError] = useState(null);

  const [localSelectedPaymentMethodId, setLocalSelectedPaymentMethodId] =
    useState(selectedPaymentMethodId);

  //================================================
  // KEEP LOCAL SELECTION IN SYNC
  //================================================

  useEffect(() => {
    setLocalSelectedPaymentMethodId(selectedPaymentMethodId);
  }, [selectedPaymentMethodId]);

  //================================================
  // LOAD PAYMENT METHODS
  //================================================

  const loadPaymentMethods = async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError(null);

      //---------------------------------------------
      // Get saved payment methods from DataStore.
      //---------------------------------------------

      const methods = await DataStore.query(PaymentMethod);

      console.log("SAVED PAYMENT METHODS FROM DATASTORE:", {
        count: methods?.length || 0,
        methods: methods?.map((method) => ({
          id: method?.id,
          userID: method?.userID,
          status: method?.status,
          reusable: method?.reusable,
          isDefault: method?.isDefault,
          last4: method?.last4,
          provider: method?.provider,
          paystackEnvironment: method?.paystackEnvironment,
          updatedAt: method?.updatedAt,
        })),
      });

      //---------------------------------------------
      // Only show active reusable Paystack methods.
      //
      // We intentionally do NOT filter by:
      //
      //     orderEnvironment
      //
      // because Order.orderEnvironment is Atua's
      // operational TEST/PRODUCTION environment.
      //
      // Paystack TEST/LIVE is handled by the backend
      // using paymentMethod.paystackEnvironment.
      //---------------------------------------------

      const activeMethods = methods.filter((method) => {
        const isActive = method?.status === "ACTIVE";

        const isReusable = method?.reusable === true;

        //-------------------------------------------
        // Provider should be PAYSTACK.
        //
        // The provider check is kept defensive so
        // older records without provider data do
        // not accidentally disappear from the UI.
        //-------------------------------------------

        const isPaystack = !method?.provider || method.provider === "PAYSTACK";

        return isActive && isReusable && isPaystack;
      });

      //---------------------------------------------
      // Sort:
      //
      // 1. Default payment method first.
      // 2. Then newest saved method first.
      //---------------------------------------------

      activeMethods.sort((a, b) => {
        if (a.isDefault && !b.isDefault) {
          return -1;
        }

        if (!a.isDefault && b.isDefault) {
          return 1;
        }

        const aDate = new Date(a.createdAt || a.updatedAt || 0).getTime();

        const bDate = new Date(b.createdAt || b.updatedAt || 0).getTime();

        return bDate - aDate;
      });

      setPaymentMethods(activeMethods);

      //---------------------------------------------
      // If there is no current selection, select the
      // default card visually.
      //
      // IMPORTANT:
      //
      // Selecting a card does NOT charge it.
      //---------------------------------------------

      if (!localSelectedPaymentMethodId && activeMethods.length > 0) {
        const defaultMethod =
          activeMethods.find((method) => method.isDefault) || activeMethods[0];

        setLocalSelectedPaymentMethodId(defaultMethod.id);
      }

      //---------------------------------------------
      // If the previously selected card no longer
      // exists, select another available card.
      //---------------------------------------------

      if (
        localSelectedPaymentMethodId &&
        !activeMethods.some(
          (method) => method.id === localSelectedPaymentMethodId,
        )
      ) {
        const replacementMethod =
          activeMethods.find((method) => method.isDefault) || activeMethods[0];

        setLocalSelectedPaymentMethodId(replacementMethod?.id || null);
      }
    } catch (loadError) {
      console.error("LOAD SAVED PAYMENT METHODS ERROR:", loadError);

      setError(
        loadError?.message || "We could not load your saved payment methods.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  //================================================
  // INITIAL LOAD
  //================================================

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  //================================================
  // SELECTED PAYMENT METHOD
  //================================================

  const selectedPaymentMethod = useMemo(() => {
    if (!localSelectedPaymentMethodId) {
      return null;
    }

    return (
      paymentMethods.find(
        (method) => method.id === localSelectedPaymentMethodId,
      ) || null
    );
  }, [paymentMethods, localSelectedPaymentMethodId]);

  //================================================
  // CARD DISPLAY HELPERS
  //================================================

  const getCardBrand = (paymentMethod) => {
    return (
      paymentMethod?.cardBrand ||
      paymentMethod?.brand ||
      paymentMethod?.cardType ||
      "Card"
    );
  };

  const getCardLast4 = (paymentMethod) => {
    return paymentMethod?.last4 || "••••";
  };

  const getExpiry = (paymentMethod) => {
    const month = paymentMethod?.expiryMonth;
    const year = paymentMethod?.expiryYear;

    if (!month || !year) {
      return null;
    }

    const formattedMonth = String(month).padStart(2, "0");

    //---------------------------------------------
    // Paystack/card records may contain either:
    //
    // 2028
    // or
    // 28
    //
    //---------------------------------------------

    const formattedYear =
      String(year).length === 4 ? String(year).slice(-2) : String(year);

    return `${formattedMonth}/${formattedYear}`;
  };

  //================================================
  // SELECT CARD
  //================================================

  const handleSelectPaymentMethod = (paymentMethod) => {
    if (paymentLoading || deletingPaymentMethodId) {
      return;
    }

    if (!paymentMethod?.id) {
      return;
    }

    setLocalSelectedPaymentMethodId(paymentMethod.id);
  };

  //================================================
  // PAY WITH SAVED CARD
  //================================================
  //
  // IMPORTANT:
  //
  // The actual charge happens in Payment.jsx.
  //
  // We simply pass the selected PaymentMethod back
  // to the parent.
  //
  // Payment.jsx will then:
  //
  // chargeAtuaPaymentMethod(...)
  //       ↓
  // Paystack charge_authorization
  //       ↓
  // Paystack webhook
  //       ↓
  // Order = PAID
  //       ↓
  // DataStore sync
  //       ↓
  // completePaymentFlow()
  //
  //================================================

  const handlePayWithSavedCard = () => {
    if (paymentLoading) {
      return;
    }

    if (!selectedPaymentMethod) {
      Alert.alert(
        "Select a card",
        "Please select a saved card before continuing.",
      );

      return;
    }

    //-----------------------------------------------
    // Only send the PaymentMethod object to the
    // parent.
    //
    // The parent should only use the ID when calling
    // the backend.
    //
    //-----------------------------------------------

    if (typeof onPayWithSavedCard === "function") {
      onPayWithSavedCard(selectedPaymentMethod);
    }
  };

  //================================================
  // DELETE PAYMENT METHOD
  //================================================

  const handleDeletePaymentMethod = (paymentMethod) => {
    if (!paymentMethod?.id) {
      return;
    }

    if (paymentLoading || deletingPaymentMethodId) {
      return;
    }

    //---------------------------------------------
    // Show confirmation before deleting.
    //---------------------------------------------

    Alert.alert(
      "Delete saved card?",
      `Remove ${getCardBrand(paymentMethod)} ending in ${getCardLast4(
        paymentMethod,
      )} from your saved payment methods?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => confirmDeletePaymentMethod(paymentMethod),
        },
      ],
    );
  };

  //================================================
  // CONFIRM DELETE
  //================================================

  const confirmDeletePaymentMethod = async (paymentMethod) => {
    try {
      setDeletingPaymentMethodId(paymentMethod.id);

      //---------------------------------------------
      // IMPORTANT:
      //
      // We use the backend mutation instead of
      // directly changing DataStore.
      //
      // The backend:
      //
      // 1. Authenticates the user.
      // 2. Confirms ownership.
      // 3. Confirms Paystack environment.
      // 4. Deactivates the Paystack authorization.
      // 5. Marks the local PaymentMethod inactive.
      // 6. Promotes another card if necessary.
      //
      //---------------------------------------------

      const mutation = /* GraphQL */ `
        mutation DeleteSavedPaymentMethod($paymentMethodId: ID!) {
          deleteSavedPaymentMethod(paymentMethodId: $paymentMethodId) {
            success
            message
            paymentMethodId
          }
        }
      `;

      //---------------------------------------------
      // Import generateClient lazily so this component
      // does not need to create another GraphQL client
      // at module initialization.
      //---------------------------------------------

      const { generateClient } = await import("aws-amplify/api");

      const graphqlClient = generateClient();

      const result = await graphqlClient.graphql({
        query: mutation,
        authMode: "userPool",
        variables: {
          paymentMethodId: paymentMethod.id,
        },
      });

      const response = result?.data?.deleteSavedPaymentMethod;

      //---------------------------------------------
      // Backend rejected the deletion.
      //---------------------------------------------

      if (!response?.success) {
        throw new Error(
          response?.message || "The saved payment method could not be deleted.",
        );
      }

      //---------------------------------------------
      // Remove it immediately from the local UI.
      //---------------------------------------------

      setPaymentMethods((currentMethods) =>
        currentMethods.filter((method) => method.id !== paymentMethod.id),
      );

      //---------------------------------------------
      // If the deleted card was selected, choose
      // another card.
      //---------------------------------------------

      if (localSelectedPaymentMethodId === paymentMethod.id) {
        const remainingMethods = paymentMethods.filter(
          (method) => method.id !== paymentMethod.id,
        );

        const replacementMethod =
          remainingMethods.find((method) => method.isDefault) ||
          remainingMethods[0];

        setLocalSelectedPaymentMethodId(replacementMethod?.id || null);
      }

      //---------------------------------------------
      // Refresh from DataStore so the UI reflects
      // the backend's final state.
      //---------------------------------------------

      await loadPaymentMethods({
        showLoading: false,
      });
    } catch (deleteError) {
      console.error("DELETE SAVED PAYMENT METHOD ERROR:", deleteError);

      Alert.alert(
        "Unable to Delete Card",
        deleteError?.message ||
          "We could not delete this saved card. Please try again.",
      );
    } finally {
      setDeletingPaymentMethodId(null);
    }
  };

  //================================================
  // USE NEW CARD
  //================================================

  const handleUseNewCard = () => {
    if (paymentLoading || deletingPaymentMethodId) {
      return;
    }

    if (typeof onUseNewCard === "function") {
      onUseNewCard();
    }
  };

  //================================================
  // LOADING
  //================================================

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Payment method</Text>

            <Text style={styles.sectionSubtitle}>
              Choose a saved card or another payment method.
            </Text>
          </View>
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#111827" />

          <Text style={styles.loadingText}>Loading saved cards...</Text>
        </View>
      </View>
    );
  }

  //================================================
  // ERROR
  //================================================

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Payment method</Text>

            <Text style={styles.sectionSubtitle}>
              Choose a saved card or another payment method.
            </Text>
          </View>
        </View>

        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={22} color="#DC2626" />

          <View style={styles.errorContent}>
            <Text style={styles.errorTitle}>Could not load saved cards</Text>

            <Text style={styles.errorText}>{error}</Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadPaymentMethods()}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.retryButtonText}>Try Again</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.newCardButton}
          onPress={handleUseNewCard}
          disabled={paymentLoading}
          activeOpacity={0.85}
        >
          <Ionicons name="wallet-outline" size={18} color="#111827" />

          <Text style={styles.newCardButtonText}>Pay with another method</Text>
        </TouchableOpacity>
      </View>
    );
  }

  //================================================
  // RENDER
  //================================================

  return (
    <View style={styles.container}>
      {/* ============================================
          HEADER
      ============================================ */}

      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderContent}>
          <Text style={styles.sectionTitle}>Payment method</Text>

          <Text style={styles.sectionSubtitle}>
            Choose a saved card or another payment method.
          </Text>
        </View>

        {refreshing ? <ActivityIndicator size="small" color="#6B7280" /> : null}
      </View>

      {/* ============================================
          SAVED CARDS
      ============================================ */}

      {paymentMethods.length > 0 ? (
        <View style={styles.paymentMethodsList}>
          {paymentMethods.map((paymentMethod) => {
            const isSelected =
              localSelectedPaymentMethodId === paymentMethod.id;

            const isDeleting = deletingPaymentMethodId === paymentMethod.id;

            const expiry = getExpiry(paymentMethod);

            return (
              <View
                key={paymentMethod.id}
                style={[
                  styles.paymentMethodCard,
                  isSelected && styles.paymentMethodCardSelected,
                  isDeleting && styles.paymentMethodCardDisabled,
                ]}
              >
                {/* ====================================
                    SELECT CARD
                ==================================== */}

                <TouchableOpacity
                  style={styles.paymentMethodSelectArea}
                  onPress={() => handleSelectPaymentMethod(paymentMethod)}
                  disabled={paymentLoading || !!deletingPaymentMethodId}
                  activeOpacity={0.8}
                >
                  {/* Radio */}
                  <View
                    style={[
                      styles.radioOuter,
                      isSelected && styles.radioOuterSelected,
                    ]}
                  >
                    {isSelected ? <View style={styles.radioInner} /> : null}
                  </View>

                  {/* Card information */}
                  <View style={styles.cardInformation}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardBrand} numberOfLines={1}>
                        {getCardBrand(paymentMethod)}
                      </Text>

                      {paymentMethod.isDefault ? (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.cardNumber}>
                      •••• •••• •••• {getCardLast4(paymentMethod)}
                    </Text>

                    {expiry ? (
                      <Text style={styles.cardExpiry}>Expires {expiry}</Text>
                    ) : null}

                    {paymentMethod.bank ? (
                      <Text style={styles.cardBank} numberOfLines={1}>
                        {paymentMethod.bank}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>

                {/* ====================================
                    DELETE
                ==================================== */}

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeletePaymentMethod(paymentMethod)}
                  disabled={paymentLoading || !!deletingPaymentMethodId}
                  activeOpacity={0.75}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : (
        /* ============================================
           NO SAVED CARDS
        ============================================ */

        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="card-outline" size={24} color="#6B7280" />
          </View>

          <Text style={styles.emptyTitle}>No saved cards</Text>

          <Text style={styles.emptyText}>
            You can save your card after completing a successful payment.
          </Text>
        </View>
      )}

      {/* ============================================
          PAY WITH SELECTED CARD
      ============================================ */}

      {paymentMethods.length > 0 ? (
        <TouchableOpacity
          style={[
            styles.payButton,
            (!selectedPaymentMethod ||
              paymentLoading ||
              !!deletingPaymentMethodId) &&
              styles.payButtonDisabled,
          ]}
          onPress={handlePayWithSavedCard}
          disabled={
            !selectedPaymentMethod ||
            paymentLoading ||
            !!deletingPaymentMethodId
          }
          activeOpacity={0.85}
        >
          {paymentLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={17} color="#FFFFFF" />

              <Text style={styles.payButtonText}>Pay with saved card</Text>

              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      ) : null}

      {/* ============================================
          USE NEW CARD
      ============================================ */}

      <TouchableOpacity
        style={[
          styles.newCardButton,
          paymentLoading && styles.newCardButtonDisabled,
        ]}
        onPress={handleUseNewCard}
        disabled={paymentLoading || !!deletingPaymentMethodId}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={18} color="#111827" />

        <Text style={styles.newCardButtonText}>Pay with another method</Text>
      </TouchableOpacity>

      {/* ============================================
          SECURITY NOTE
      ============================================ */}

      <View style={styles.securityNote}>
        <Ionicons name="shield-checkmark-outline" size={15} color="#15803D" />

        <Text style={styles.securityNoteText}>
          Your full card number and CVV are never stored by Atua.
        </Text>
      </View>
    </View>
  );
};

export default SavedPaymentMethods;
