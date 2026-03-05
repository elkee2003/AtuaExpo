import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect } from "react";

export default function VideoPlayerItem({ uri, isActive, style }) {
  const player = useVideoPlayer({ uri }, (player) => {
    player.loop = false;
  });

  useEffect(() => {
    if (!player) return;

    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <VideoView
      player={player}
      style={style}
      nativeControls
      contentFit="contain"
    />
  );
}
