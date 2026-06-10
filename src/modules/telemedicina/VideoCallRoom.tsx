import * as React from "react";
import { useTranslation } from "react-i18next";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Button } from "@components/ui/button";
import { cn } from "@utils/cn";

interface VideoCallRoomProps {
  onEndCall: () => void;
}

export function VideoCallRoom({ onEndCall }: VideoCallRoomProps) {
  const { t } = useTranslation();
  const localVideoRef = React.useRef<HTMLVideoElement>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = React.useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = React.useState(true);
  const [videoEnabled, setVideoEnabled] = React.useState(true);
  const [inCall, setInCall] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, [localStream]);

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setInCall(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al acceder a c\u00e1mara/micr\u00f3fono");
    }
  };

  const endCall = () => {
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
