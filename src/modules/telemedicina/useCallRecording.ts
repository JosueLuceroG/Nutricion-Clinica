import * as React from "react";

type RecordingError = "unsupported" | "missing-stream" | "start-failed";

interface UseCallRecordingOptions {
  salaId: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

interface UseCallRecordingReturn {
  isRecording: boolean;
  error: RecordingError | null;
  startRecording: () => boolean;
  stopRecording: () => void;
}

export function useCallRecording({
  salaId,
  localStream,
  remoteStream,
}: UseCallRecordingOptions): UseCallRecordingReturn {
  const [isRecording, setIsRecording] = React.useState(false);
  const [error, setError] = React.useState<RecordingError | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  const stopRecording = React.useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  React.useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  const startRecording = React.useCallback(() => {
    if (typeof MediaRecorder === "undefined") {
      setError("unsupported");
      return false;
    }

    const stream = buildRecordingStream(localStream, remoteStream);
    if (!stream) {
      setError("missing-stream");
      return false;
    }

    try {
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        setIsRecording(false);
        downloadRecording(salaId, chunksRef.current, recorder.mimeType);
        chunksRef.current = [];
        recorderRef.current = null;
      };

      recorder.start(1000);
      setError(null);
      setIsRecording(true);
      return true;
    } catch {
      setError("start-failed");
      return false;
    }
  }, [localStream, remoteStream, salaId]);

  return { isRecording, error, startRecording, stopRecording };
}

function buildRecordingStream(localStream: MediaStream | null, remoteStream: MediaStream | null): MediaStream | null {
  const tracks: MediaStreamTrack[] = [];
  const videoTrack = remoteStream?.getVideoTracks()[0] ?? localStream?.getVideoTracks()[0];
  if (videoTrack) tracks.push(videoTrack);

  for (const track of remoteStream?.getAudioTracks() ?? []) tracks.push(track);
  for (const track of localStream?.getAudioTracks() ?? []) tracks.push(track);

  return tracks.length > 0 ? new MediaStream(tracks) : null;
}

function getSupportedMimeType(): string {
  const preferred = "video/webm;codecs=vp8,opus";
  return MediaRecorder.isTypeSupported(preferred) ? preferred : "video/webm";
}

function downloadRecording(salaId: string, chunks: Blob[], mimeType: string): void {
  if (chunks.length === 0) return;
  const blob = new Blob(chunks, { type: mimeType || "video/webm" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `nutriclinica-sala-${salaId.slice(0, 8)}-${stamp}.webm`;
  a.click();
  URL.revokeObjectURL(url);
}
