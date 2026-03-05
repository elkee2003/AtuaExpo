import Ionicons from "@expo/vector-icons/Ionicons";
import {
    CameraView,
    useCameraPermissions,
    useMicrophonePermissions,
} from "expo-camera";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import cameraCaptureStyles from "./cameraCaptureStyles";

export default function CameraCapture({
  mode,
  onPhotoCaptured,
  onVideoCaptured,
  onClose,
}) {
  /** =========================
     * REFS
     ========================== */

  const cameraRef = useRef(null);
  const timerRef = useRef(null);
  const recordingStartRef = useRef(null);
  const pausedTimeRef = useRef(0);

  /** =========================
     * PERMISSIONS
     ========================== */

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  /** =========================
     * STATE
     ========================== */

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);

  const [recordDuration, setRecordDuration] = useState(0);

  const [facing, setFacing] = useState("back");
  const [flash, setFlash] = useState("off");

  /** =========================
     * HELPERS
     ========================== */

  const generateTimestamp = () => new Date().toISOString();

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  /** =========================
     * REQUEST PERMISSIONS ON LOAD
     ========================== */

  useEffect(() => {
    (async () => {
      await requestCameraPermission();
      await requestMicPermission();
    })();
  }, []);

  /** =========================
     * TIMER LOGIC
     ========================== */

  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        const now = Date.now();

        const duration =
          Math.floor((now - recordingStartRef.current) / 1000) -
          pausedTimeRef.current;

        setRecordDuration(duration);
      }, 250);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, isPaused]);

  /** =========================
     * STOP ALL RECORDING STATE
     ========================== */

  const stopAll = () => {
    setIsRecording(false);
    setIsPaused(false);
    setRecordDuration(0);

    pausedTimeRef.current = 0;
    recordingStartRef.current = null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  /** =========================
     * PHOTO CAPTURE
     ========================== */

  const takePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      setLoading(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        flash,
      });

      onPhotoCaptured?.({
        ...photo,
        recordedAt: generateTimestamp(),
      });

      onClose?.();
    } finally {
      setLoading(false);
    }
  };

  /** =========================
     * START VIDEO RECORDING
     ========================== */

  const startRecording = async () => {
    if (!cameraRef.current) return;

    // Ensure microphone permission
    if (!micPermission?.granted) {
      const result = await requestMicPermission();

      if (!result.granted) {
        alert("Microphone permission is required");
        return;
      }
    }

    try {
      setIsRecording(true);
      setIsPaused(false);

      pausedTimeRef.current = 0;
      recordingStartRef.current = Date.now();

      const video = await cameraRef.current.recordAsync({
        quality: "480p",
        maxDuration: 30,
      });

      onVideoCaptured?.({
        ...video,
        recordedAt: generateTimestamp(),
        duration: recordDuration,
      });
    } catch (e) {
      console.log(e);
    } finally {
      stopAll();

      setTimeout(() => {
        onClose?.();
      }, 300);
    }
  };

  /** =========================
     * STOP RECORDING
     ========================== */

  const stopRecording = () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
    }
  };

  /** =========================
     * PAUSE RECORDING
     ========================== */

  const pauseRecording = () => {
    setIsPaused(true);
  };

  /** =========================
     * RESUME RECORDING
     ========================== */

  const resumeRecording = () => {
    setIsPaused(false);
  };

  /** =========================
     * CAMERA CONTROLS
     ========================== */

  const flipCamera = () => {
    setFacing((prev) => (prev === "back" ? "front" : "back"));
  };

  const toggleFlash = () => {
    setFlash((prev) =>
      prev === "off" ? "on" : prev === "on" ? "auto" : "off",
    );
  };

  /** =========================
     * PERMISSION CHECK UI
     ========================== */

  const permissionsGranted =
    cameraPermission?.granted && micPermission?.granted;

  if (!permissionsGranted) {
    return (
      <SafeAreaView style={cameraCaptureStyles.permissionContainer}>
        <StatusBar barStyle="dark-content" />

        <View style={cameraCaptureStyles.permissionContent}>
          <Ionicons
            name="camera-outline"
            size={64}
            color="#555"
            style={{ marginBottom: 20 }}
          />

          <Text style={cameraCaptureStyles.permissionTitle}>
            Camera & Microphone Access Needed
          </Text>

          <Text style={cameraCaptureStyles.permissionSubtitle}>
            Atua needs access to your camera and microphone to take photos and
            record videos.
          </Text>

          <TouchableOpacity
            style={cameraCaptureStyles.permissionButton}
            onPress={async () => {
              await requestCameraPermission();
              await requestMicPermission();
            }}
          >
            <Text style={cameraCaptureStyles.permissionButtonText}>
              Grant Permission
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /** =========================
     * MAIN CAMERA UI
     ========================== */

  return (
    <View style={cameraCaptureStyles.container}>
      <StatusBar barStyle="light-content" />

      <CameraView
        ref={cameraRef}
        style={cameraCaptureStyles.camera}
        facing={facing}
        flash={flash}
        mode={mode === "video" ? "video" : "picture"}
      />

      {/* TOP BAR */}

      <SafeAreaView style={cameraCaptureStyles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>

        {mode === "video" && isRecording && (
          <Text style={cameraCaptureStyles.timerText}>
            ● {formatTime(recordDuration)}
          </Text>
        )}

        <View style={{ flexDirection: "row", gap: 20 }}>
          <TouchableOpacity onPress={toggleFlash}>
            <Ionicons name="flash" size={22} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity onPress={flipCamera}>
            <Ionicons name="camera-reverse" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* BOTTOM BAR */}

      <SafeAreaView style={cameraCaptureStyles.bottomBar}>
        {mode === "photo" && (
          <TouchableOpacity
            style={cameraCaptureStyles.captureButton}
            onPress={takePhoto}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <View style={cameraCaptureStyles.innerCircle} />
            )}
          </TouchableOpacity>
        )}

        {mode === "video" && (
          <View style={{ alignItems: "center" }}>
            {!isRecording ? (
              <TouchableOpacity
                style={cameraCaptureStyles.captureButton}
                onPress={startRecording}
              >
                <View style={cameraCaptureStyles.recordCircle} />
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={cameraCaptureStyles.captureButton}
                  onPress={stopRecording}
                >
                  <View style={cameraCaptureStyles.stopSquare} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ marginTop: 16 }}
                  onPress={isPaused ? resumeRecording : pauseRecording}
                >
                  <Ionicons
                    name={isPaused ? "play" : "pause"}
                    size={26}
                    color="#FFF"
                  />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
