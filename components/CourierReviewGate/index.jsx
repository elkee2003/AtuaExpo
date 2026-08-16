import { useAuthContext } from "@/providers/AuthProvider";
import { Courier, CourierReview, Order } from "@/src/models";

import { DataStore } from "aws-amplify/datastore";
import { getUrl } from "aws-amplify/storage";

import { useCallback, useEffect, useRef, useState } from "react";

import CourierReviewModal from "./courierReviewModal";

//==================================================
// COURIER REVIEW GATE
//==================================================

const CourierReviewGate = () => {
  //-----------------------------------------
  // Auth
  //-----------------------------------------

  const { dbUser } = useAuthContext();

  //-----------------------------------------
  // State
  //-----------------------------------------

  const [pendingReviews, setPendingReviews] = useState([]);

  const [activeReview, setActiveReview] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  const [submitError, setSubmitError] = useState(null);

  //-----------------------------------------
  // Refs
  //-----------------------------------------

  // Prevent duplicate submission.
  const submittingRef = useRef(false);

  // Orders that have successfully been reviewed
  // during this mounted session.
  const submittedOrderIdsRef = useRef(new Set());

  // Prevent stale asynchronous refreshes from
  // overwriting newer results.
  const refreshSequenceRef = useRef(0);

  // Prevent the same active order from being
  // unnecessarily replaced while DataStore
  // emits updates.
  const activeOrderIdRef = useRef(null);

  //==================================================
  // RESET USER SESSION
  //==================================================

  useEffect(() => {
    //-----------------------------------------
    // When user changes/logs out
    //-----------------------------------------

    submittedOrderIdsRef.current = new Set();

    activeOrderIdRef.current = null;

    setPendingReviews([]);

    setActiveReview(null);

    setSubmitting(false);

    setSubmitError(null);

    submittingRef.current = false;
  }, [dbUser?.id]);

  //==================================================
  // LOAD PENDING REVIEWS
  //==================================================

  const loadPendingReviews = useCallback(async () => {
    //-----------------------------------------
    // No authenticated user
    //-----------------------------------------

    if (!dbUser?.id) {
      setPendingReviews([]);

      return;
    }

    //-----------------------------------------
    // Create refresh sequence
    //-----------------------------------------

    const refreshSequence = ++refreshSequenceRef.current;

    try {
      //---------------------------------------
      // Fetch user's orders
      //---------------------------------------

      const orders = await DataStore.query(Order, (order) =>
        order.userID.eq(dbUser.id),
      );

      //---------------------------------------
      // Ignore stale refresh
      //---------------------------------------

      if (refreshSequence !== refreshSequenceRef.current) {
        return;
      }

      //---------------------------------------
      // Only orders that are candidates
      //---------------------------------------
      //
      // Requirements:
      //
      // 1. DELIVERED
      // 2. Has assigned courier
      // 3. Has not already been submitted
      //
      //---------------------------------------

      const deliveredOrders = orders.filter(
        (order) =>
          order.status === "DELIVERED" &&
          !!order.assignedCourierId &&
          !submittedOrderIdsRef.current.has(order.id),
      );

      //---------------------------------------
      // No candidate orders
      //---------------------------------------

      if (deliveredOrders.length === 0) {
        setPendingReviews([]);

        return;
      }

      //---------------------------------------
      // Fetch all reviews belonging to user
      //---------------------------------------
      //
      // Because CourierReview has:
      //
      // userID @index(name: "byUser")
      //
      // we can retrieve the user's reviews
      // once instead of querying every order.
      //
      //---------------------------------------

      const userReviews = await DataStore.query(CourierReview, (review) =>
        review.userID.eq(dbUser.id),
      );

      //---------------------------------------
      // Ignore stale refresh
      //---------------------------------------

      if (refreshSequence !== refreshSequenceRef.current) {
        return;
      }

      //---------------------------------------
      // Build reviewed order ID set
      //---------------------------------------

      const reviewedOrderIds = new Set(
        userReviews.map((review) => review.orderID).filter(Boolean),
      );

      //---------------------------------------
      // Remove already reviewed orders
      //---------------------------------------

      const unreviewedOrders = deliveredOrders.filter(
        (order) => !reviewedOrderIds.has(order.id),
      );

      //---------------------------------------
      // Nothing left
      //---------------------------------------

      if (unreviewedOrders.length === 0) {
        setPendingReviews([]);

        return;
      }

      //---------------------------------------
      // Sort oldest completed orders first
      //---------------------------------------

      unreviewedOrders.sort(
        (a, b) =>
          new Date(a.createdAt ?? 0).getTime() -
          new Date(b.createdAt ?? 0).getTime(),
      );

      //---------------------------------------
      // Enrich orders with couriers
      //---------------------------------------

      const enrichedReviews = await Promise.all(
        unreviewedOrders.map(async (order) => {
          let courier = null;

          //---------------------------------
          // First use relationship
          //---------------------------------

          try {
            courier = await order.assignedCourier;
          } catch (error) {
            console.log("COURIER RELATIONSHIP ERROR:", error);
          }

          //---------------------------------
          // Fallback to direct query
          //---------------------------------

          if (!courier) {
            try {
              courier = await DataStore.query(Courier, order.assignedCourierId);
            } catch (error) {
              console.log("COURIER QUERY ERROR:", error);
            }
          }

          //---------------------------------
          // Courier unavailable
          //---------------------------------

          if (!courier) {
            return null;
          }

          //---------------------------------
          // Courier image
          //---------------------------------

          //---------------------------------
          // Courier image
          //---------------------------------

          let courierImageUrl = null;

          if (courier?.profilePic && courier.profilePic.trim() !== "") {
            try {
              const storagePath = courier.profilePic.trim();

              console.log("COURIER PROFILE PIC:", storagePath);

              const result = await getUrl({
                path: storagePath,
                options: {
                  validateObjectExistence: true,
                },
              });

              if (result?.url) {
                courierImageUrl = result.url.toString();

                console.log("COURIER IMAGE URL:", courierImageUrl);
              }
            } catch (error) {
              console.log("Error fetching courier profile pic URL:", error);

              courierImageUrl = null;
            }
          }

          //---------------------------------
          // Return enriched review
          //---------------------------------

          return {
            order,
            courier,
            courierImageUrl,
          };
        }),
      );

      //---------------------------------------
      // Remove failed enrichments
      //---------------------------------------

      const validReviews = enrichedReviews.filter(Boolean);

      //---------------------------------------
      // Ignore stale refresh
      //---------------------------------------

      if (refreshSequence !== refreshSequenceRef.current) {
        return;
      }

      //---------------------------------------
      // Update queue
      //---------------------------------------

      setPendingReviews(validReviews);
    } catch (error) {
      console.log("LOAD PENDING COURIER REVIEWS ERROR:", error);
    }
  }, [dbUser?.id]);

  //==================================================
  // OBSERVE USER ORDERS
  //==================================================

  useEffect(() => {
    //-----------------------------------------
    // No authenticated user
    //-----------------------------------------

    if (!dbUser?.id) {
      return;
    }

    let subscription;

    //-----------------------------------------
    // Initial load
    //-----------------------------------------

    loadPendingReviews();

    //-----------------------------------------
    // Observe user's orders
    //-----------------------------------------

    subscription = DataStore.observeQuery(Order, (order) =>
      order.userID.eq(dbUser.id),
    ).subscribe({
      next: () => {
        loadPendingReviews();
      },

      error: (error) => {
        console.log("COURIER REVIEW ORDER OBSERVER ERROR:", error);
      },
    });

    //-----------------------------------------
    // Cleanup
    //-----------------------------------------

    return () => {
      subscription?.unsubscribe();

      refreshSequenceRef.current += 1;
    };
  }, [dbUser?.id, loadPendingReviews]);

  //==================================================
  // ACTIVATE NEXT REVIEW
  //==================================================

  useEffect(() => {
    //-----------------------------------------
    // No pending reviews
    //-----------------------------------------

    if (pendingReviews.length === 0) {
      setActiveReview(null);

      activeOrderIdRef.current = null;

      return;
    }

    //-----------------------------------------
    // Active review still exists
    //-----------------------------------------

    if (activeOrderIdRef.current) {
      const activeStillExists = pendingReviews.some(
        (item) => item.order.id === activeOrderIdRef.current,
      );

      if (activeStillExists) {
        return;
      }
    }

    //-----------------------------------------
    // Select next review
    //-----------------------------------------

    const nextReview = pendingReviews[0];

    activeOrderIdRef.current = nextReview.order.id;

    setSubmitError(null);

    setActiveReview(nextReview);
  }, [pendingReviews]);

  //==================================================
  // SUBMIT REVIEW
  //==================================================

  const handleSubmitReview = async ({ rating, comment }) => {
    //-----------------------------------------
    // Validate active review
    //-----------------------------------------

    if (!activeReview) {
      return;
    }

    //-----------------------------------------
    // Prevent duplicate submission
    //-----------------------------------------

    if (submittingRef.current) {
      return;
    }

    //-----------------------------------------
    // Validate authentication
    //-----------------------------------------

    if (!dbUser?.id) {
      setSubmitError("Your account could not be verified. Please try again.");

      return;
    }

    //-----------------------------------------
    // Extract data
    //-----------------------------------------

    const { order, courier } = activeReview;

    //-----------------------------------------
    // Validate order
    //-----------------------------------------

    if (!order?.id) {
      setSubmitError("We could not identify this delivery.");

      return;
    }

    //-----------------------------------------
    // Validate courier
    //-----------------------------------------

    if (!courier?.id) {
      setSubmitError("We could not identify the courier for this delivery.");

      return;
    }

    //-----------------------------------------
    // Validate rating
    //-----------------------------------------

    const numericRating = Number(rating);

    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      setSubmitError("Please select a rating from 1 to 5 stars.");

      return;
    }

    //-----------------------------------------
    // Lock submission
    //-----------------------------------------

    submittingRef.current = true;

    setSubmitting(true);

    setSubmitError(null);

    try {
      //---------------------------------------
      // Get latest order
      //---------------------------------------

      const latestOrder = await DataStore.query(Order, order.id);

      //---------------------------------------
      // Order no longer exists
      //---------------------------------------

      if (!latestOrder) {
        throw new Error("This delivery could not be found.");
      }

      //---------------------------------------
      // Confirm delivery is still valid
      //---------------------------------------

      if (latestOrder.status !== "DELIVERED") {
        throw new Error("This delivery is no longer available for review.");
      }

      //---------------------------------------
      // Confirm courier still matches
      //---------------------------------------

      if (latestOrder.assignedCourierId !== courier.id) {
        throw new Error("The courier assigned to this delivery has changed.");
      }

      //---------------------------------------
      // Final duplicate check
      //---------------------------------------
      //
      // This is intentionally performed
      // immediately before creating the review.
      //
      //---------------------------------------

      const existingReviews = await DataStore.query(CourierReview, (review) =>
        review.orderID.eq(order.id),
      );

      //---------------------------------------
      // Review already exists
      //---------------------------------------

      if (existingReviews.length > 0) {
        submittedOrderIdsRef.current.add(order.id);

        setPendingReviews((current) =>
          current.filter((item) => item.order.id !== order.id),
        );

        activeOrderIdRef.current = null;

        setActiveReview(null);

        return;
      }

      //---------------------------------------
      // Create CourierReview
      //---------------------------------------

      await DataStore.save(
        new CourierReview({
          courierID: courier.id,

          userID: dbUser.id,

          orderID: order.id,

          rating: numericRating,

          comment:
            typeof comment === "string" && comment.trim().length > 0
              ? comment.trim()
              : null,
        }),
      );

      //---------------------------------------
      // Mark submitted locally
      //---------------------------------------

      submittedOrderIdsRef.current.add(order.id);

      //---------------------------------------
      // Remove from queue
      //---------------------------------------

      setPendingReviews((current) =>
        current.filter((item) => item.order.id !== order.id),
      );

      //---------------------------------------
      // Clear active review
      //---------------------------------------

      activeOrderIdRef.current = null;

      setActiveReview(null);

      setSubmitError(null);
    } catch (error) {
      console.log("SUBMIT COURIER REVIEW ERROR:", error);

      //---------------------------------------
      // Show user-friendly error
      //---------------------------------------

      setSubmitError(
        error?.message || "We couldn't submit your review. Please try again.",
      );
    } finally {
      submittingRef.current = false;

      setSubmitting(false);
    }
  };

  //==================================================
  // RENDER
  //==================================================

  if (!activeReview) {
    return null;
  }

  return (
    <CourierReviewModal
      visible={true}
      order={activeReview.order}
      courier={activeReview.courier}
      courierImageUrl={activeReview.courierImageUrl}
      loading={submitting}
      error={submitError}
      onSubmit={handleSubmitReview}
    />
  );
};

export default CourierReviewGate;
