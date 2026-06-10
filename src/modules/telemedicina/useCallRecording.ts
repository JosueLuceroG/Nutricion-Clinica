import * as React from "react";
import {
  recordingStorageService,
  type TelemedicinaRecordingSummary,
} from "./recordingStorageService";

type RecordingError =
  | "unsupported"
  | "missing-stream"
  | "start-failed"
  | "save-failed"
  | "download-failed"
  | "delete-failed"
  | "upload-failed"
  | "remote-delete-failed";

interface UseCallRecordingOptions {
  salaId: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

interface UseCallRecordingReturn {
  isRecording: boolean;
  isSaving: boolean;
  error: RecordingError | null;
  recordings: TelemedicinaRecordingSummary[];
  lastSavedRecording: TelemedicinaRecordingSummary | null;
  startRecording: (consentAcceptedAt: string) => boolean;
  stopRecording: () => void;
  downloadRecording: (id: string) => Promise<boolean>;
  deleteRecording: (id: string) => Promise<boolean>;
  uploadRecording: (id: string) => Promise<boolean>;
  deleteRemoteRecording: (id: string) => Promise<boolean>;
  refreshRecordings: () => Promise<void>;
}

export function useCallRecording({
  salaId,
  localStream,
  remoteStream,
}: UseCallRecordingOptions): UseCallRecordingReturn {
  const [isRecording, setIsRecording] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<RecordingError | null>(null);
  const [recordings, setRecordings] = React.useState<TelemedicinaRecordingSummary[]>([]);
  const [lastSavedRecording, setLastSavedRecording] = React.useState<TelemedicinaRecordingSummary | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const startedAtRef = React.useRef<number>(0);
  const consentAcceptedAtRef = React.useRef<string>("");

  const refreshRecordings = React.useCallback(async () => {
    setRecordings(await recordingStorageService.listBySala(salaId));
  }, [salaId]);

  React.useEffect(() => {
    void refreshRecordings();
  }, [refreshRecordings]);

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

  const startRecording = React.useCallback((consentAcceptedAt: string) => {
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
      startedAtRef.current = Date.now();
      consentAcceptedAtRef.current = consentAcceptedAt;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        setIsRecording(false);
        const chunks = chunksRef.current;
        chunksRef.current = [];
        recorderRef.current = null;
        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
        const durationMs = Math.max(0, Date.now() - startedAtRef.current);
        setIsSaving(true);
        recordingStorageService
          .saveEncrypted({
            salaId,
            blob,
            durationMs,
            consentAcceptedAt: consentAcceptedAtRef.current,
          })
          .then((saved) => {
            setLastSavedRecording(saved);
            return refreshRecordings();
          })
          .catch(() => setError("save-failed"))
          .finally(() => setIsSaving(false));
      };

      recorder.start(1000);
      setError(null);
      setIsRecording(true);
      return true;
    } catch {
      setError("start-failed");
      return false;
    }
  }, [localStream, refreshRecordings, remoteStream, salaId]);

  const downloadRecording = React.useCallback(async (id: string) => {
    try {
      const downloaded = await recordingStorageService.download(id);
      if (!downloaded) setError("download-failed");
      return downloaded;
    } catch {
      setError("download-failed");
      return false;
    }
  }, []);

  const deleteRecording = React.useCallback(async (id: string) => {
    try {
      await recordingStorageService.deleteLocal(id);
      await refreshRecordings();
      return true;
    } catch {
      setError("delete-failed");
      return false;
    }
  }, [refreshRecordings]);

  const uploadRecording = React.useCallback(async (id: string) => {
    try {
      const uploaded = await recordingStorageService.uploadRemote(id);
      if (!uploaded) return false;
      await refreshRecordings();
      return true;
    } catch {
      setError("upload-failed");
      return false;
    }
  }, [refreshRecordings]);

  const deleteRemoteRecording = React.useCallback(async (id: string) => {
    try {
      const deleted = await recordingStorageService.deleteRemote(id);
      if (!deleted) return false;
      await refreshRecordings();
      return true;
    } catch {
      setError("remote-delete-failed");
      return false;
    }
  }, [refreshRecordings]);

  return {
    isRecording,
    isSaving,
    error,
    recordings,
    lastSavedRecording,
    startRecording,
    stopRecording,
    downloadRecording,
    deleteRecording,
    uploadRecording,
    deleteRemoteRecording,
    refreshRecordings,
  };
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
