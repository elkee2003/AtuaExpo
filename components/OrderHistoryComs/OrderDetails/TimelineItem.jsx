const TimelineItem = ({ label, value }) => {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineDot} />
      <View>
        <Text style={styles.timelineLabel}>{label}</Text>
        <Text style={styles.timelineTime}>
          {value
            ? new Date(value).toLocaleString([], {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "-"}
        </Text>
      </View>
    </View>
  );
};
