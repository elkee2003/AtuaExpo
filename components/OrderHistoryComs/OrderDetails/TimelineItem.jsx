const TimelineItem = ({ label, value }) => {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineDot} />
      <View>
        <Text style={styles.timelineLabel}>{label}</Text>
        <Text style={styles.timelineTime}>
          {value ? new Date(value).toLocaleString() : "-"}
        </Text>
      </View>
    </View>
  );
};
