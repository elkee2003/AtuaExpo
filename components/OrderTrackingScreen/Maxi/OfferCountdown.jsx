import { useEffect, useState } from "react";
import { Text } from "react-native";
import styles from "./styles";

const OfferCountdown = ({ expiresAt }) => {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date(expiresAt) - new Date();
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}:${secs < 10 ? "0" : ""}${secs}`);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Text style={styles.countdown}>Offer window closes in {remaining}</Text>
  );
};

export default OfferCountdown;
