// This will be deleted after I use the design for admin
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import DetailedPost from "../../../components/SearchResultsComs/MaxiTypes/AdminDetailedPost";

const DetailedTransportPost = () => {
  const { id } = useLocalSearchParams();

  return (
    <View style={{ flex: 1 }}>
      <DetailedPost />
    </View>
  );
};

export default DetailedTransportPost;
