const Button = ({ title, onPress, type }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, type === "outline" && styles.outlineButton]}
    >
      <Text
        style={[styles.buttonText, type === "outline" && { color: "#111" }]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};
