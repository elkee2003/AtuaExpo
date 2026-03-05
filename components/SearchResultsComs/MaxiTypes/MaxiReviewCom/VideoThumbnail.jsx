import { VideoView, useVideoPlayer } from "expo-video";

export default function VideoThumbnail({ uri, style }) {
  const player = useVideoPlayer({ uri }, (player) => {
    player.loop = false;
    player.muted = true;
  });

  return (
    <VideoView
      player={player}
      style={style}
      contentFit="cover"
      nativeControls={false}
    />
  );
}
