import * as React from "react";
import { useTranslation } from "react-i18next";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Circle, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@components/ui/button";
import { cn } from "@utils/cn";
import { useWebRTC } from "./useWebRTC";
import { useCallRecording } from "./useCallRecording";

interface VideoCallRoomProps {
  salaId: string;
  onEndCall: () => void;
}

export function VideoCallRoom({ salaId, onEndCall }: VideoCallRoomProps) {
  const { t } = useTranslation();
  const localVideoRef = React.useRef<HTMLVideoElement>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = React.useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = React.useState(true);
  const [videoEnabled, setVideoEnabled] = React.useState(true);
  const [inCall, setInCall] = React.useState(false);
  const [mediaError, setMediaError] = React.useState<string | null>(null);

  const { remoteStream, peers, connected, startCall: startSignaling, endCall: endSignaling, error: signalingError } = useWebRTC({ salaId, localStream });
  const { isRecording, error: recordingError, startRecording, stopRecording } = useCallRecording({ salaId, localStream, remoteStream });

  React.useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  React.useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const localStreamRef = React.useRef<MediaStream | null>(null);
  React.useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  React.useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setInCall(true);
      setMediaError(null);
      startSignaling(stream);
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : "Error al acceder a c\u00e1mara/micr\u00f3fono");
    }
  };

  const endCall = () => {
    if (isRecording) stopRecording();
    endSignaling();
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setInCall(false);
    onEndCall();
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
      setAudioEnabled((v) => !v);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
      setVideoEnabled((v) => !v);
    }
  };

  const error = mediaError ?? signalingError;

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
      toast.success(t("telemedicina.recording_saved"));
      return;
    }
    const started = startRecording();
    if (started) toast.success(t("telemedicina.recording_started"));
  };

  return (
    <div className="relative flex h-full flex-col">
      <div className="relative flex-1 bg-black rounded-lg overflow-hidden">
        {inCall ? (
          <>
            <video
              ref={remoteVideoRef}
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay
              playsInline
            />
            <video
              ref={localVideoRef}
              className="absolute bottom-4 right-4 h-32 w-44 rounded-lg border-2 border-background object-cover shadow-lg"
              autoPlay
              playsInline
              muted
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p className="text-sm">{error ?? t("telemedicina.preview")}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 p-4">
        {inCall ? (
          <>
            {peers.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {connected ? t("telemedicina.connected") : t("telemedicina.connecting")} ({peers.length})
              </span>
            )}
            {recordingError && (
              <span className="text-xs text-destructive">
                {t(`telemedicina.recording_error_${recordingError}`)}
              </span>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleRecording}
              className={cn("h-12 w-12 rounded-full", isRecording && "border-destructive bg-destructive/10 text-destructive")}
              aria-label={isRecording ? t("telemedicina.stop_recording") : t("telemedicina.record")}
            >
              {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Circle className="h-5 w-5" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleAudio}
              className={cn("h-12 w-12 rounded-full", !audioEnabled && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
              aria-label={audioEnabled ? t("telemedicina.mute") : t("telemedicina.unmute")}
            >
              {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleVideo}
              className={cn("h-12 w-12 rounded-full", !videoEnabled && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
              aria-label={videoEnabled ? t("telemedicina.hide_video") : t("telemedicina.show_video")}
            >
              {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={endCall}
              className="h-12 w-12 rounded-full"
              aria-label={t("telemedicina.end_call")}
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </>
        ) : (
          <Button onClick={startCall} className="gap-2">
            <Phone className="h-4 w-4" />
            {t("telemedicina.start_call")}
          </Button>
        )}
      </div>
    </div>
  );
}
