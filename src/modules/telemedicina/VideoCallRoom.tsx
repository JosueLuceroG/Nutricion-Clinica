import * as React from "react";
import { useTranslation } from "react-i18next";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Circle, Square, Download, Upload, Trash2, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Checkbox } from "@components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@components/ui/dialog";
import { Label } from "@components/ui/label";
import { telemedicinaApi } from "@services/api/telemedicinaApi";
import { cn } from "@utils/cn";
import type { TelemedicinaGrabacionDTO } from "@nutriclinica/shared";
import { useWebRTC } from "./useWebRTC";
import { useCallRecording } from "./useCallRecording";
import { recordingStorageService } from "./recordingStorageService";

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
  const [consentOpen, setConsentOpen] = React.useState(false);
  const [consentAccepted, setConsentAccepted] = React.useState(false);
  const [recordingAction, setRecordingAction] = React.useState<string | null>(null);
  const [remoteRecordings, setRemoteRecordings] = React.useState<TelemedicinaGrabacionDTO[]>([]);
  const [remoteLoading, setRemoteLoading] = React.useState(false);
  const [remoteError, setRemoteError] = React.useState(false);

  const { remoteStream, peers, connected, startCall: startSignaling, endCall: endSignaling, error: signalingError } = useWebRTC({ salaId, localStream });
  const {
    isRecording,
    isSaving,
    error: recordingError,
    recordings,
    lastSavedRecording,
    startRecording,
    stopRecording,
    downloadRecording,
    deleteRecording,
    uploadRecording,
    deleteRemoteRecording,
    refreshRecordings,
  } = useCallRecording({ salaId, localStream, remoteStream });

  const loadRemoteRecordings = React.useCallback(async () => {
    setRemoteLoading(true);
    try {
      const response = await telemedicinaApi.listRecordings(salaId);
      setRemoteRecordings(response.grabaciones);
      setRemoteError(false);
    } catch {
      setRemoteError(true);
    } finally {
      setRemoteLoading(false);
    }
  }, [salaId]);

  React.useEffect(() => {
    void loadRemoteRecordings();
  }, [loadRemoteRecordings]);

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

  React.useEffect(() => {
    if (lastSavedRecording) toast.success(t("telemedicina.recording_saved_encrypted"));
  }, [lastSavedRecording, t]);

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
      toast.success(t("telemedicina.recording_encrypting"));
      return;
    }
    setConsentAccepted(false);
    setConsentOpen(true);
  };

  const confirmRecordingConsent = () => {
    const started = startRecording(new Date().toISOString());
    if (started) {
      setConsentOpen(false);
      toast.success(t("telemedicina.recording_started"));
    }
  };

  const runRecordingAction = async (key: string, action: () => Promise<boolean>) => {
    setRecordingAction(key);
    try {
      return await action();
    } finally {
      setRecordingAction(null);
    }
  };

  const handleRefreshRecordings = async () => {
    await Promise.all([refreshRecordings(), loadRemoteRecordings()]);
  };

  const handleDownloadRecording = async (id: string) => {
    const downloaded = await runRecordingAction(`download:${id}`, () => downloadRecording(id));
    if (downloaded) toast.success(t("telemedicina.recording_downloaded"));
    else toast.error(t("telemedicina.recording_error_download-failed"));
  };

  const handleUploadRecording = async (id: string) => {
    const uploaded = await runRecordingAction(`upload:${id}`, () => uploadRecording(id));
    if (uploaded) {
      toast.success(t("telemedicina.recording_uploaded"));
      await loadRemoteRecordings();
    } else {
      toast.error(t("telemedicina.recording_error_upload-failed"));
    }
  };

  const handleDeleteRemoteRecording = async (id: string) => {
    const deleted = await runRecordingAction(`remote-delete:${id}`, () => deleteRemoteRecording(id));
    if (deleted) {
      toast.success(t("telemedicina.recording_remote_deleted"));
      await loadRemoteRecordings();
    } else {
      toast.error(t("telemedicina.recording_error_remote-delete-failed"));
    }
  };

  const handleDeleteLocalRecording = async (id: string) => {
    const deleted = await runRecordingAction(`delete:${id}`, () => deleteRecording(id));
    if (deleted) toast.success(t("telemedicina.recording_local_deleted"));
    else toast.error(t("telemedicina.recording_error_delete-failed"));
  };

  const handleDownloadRemoteRecording = async (recording: TelemedicinaGrabacionDTO) => {
    const downloaded = await runRecordingAction(`remote-download:${recording.id}`, async () => {
      try {
        return await recordingStorageService.downloadRemoteEncrypted(recording);
      } catch {
        return false;
      }
    });
    if (downloaded) toast.success(t("telemedicina.recording_remote_downloaded"));
    else toast.error(t("telemedicina.recording_remote_error"));
  };

  const handleDeleteRemoteOnlyRecording = async (recording: TelemedicinaGrabacionDTO) => {
    const deleted = await runRecordingAction(`remote-only-delete:${recording.id}`, async () => {
      try {
        await telemedicinaApi.deleteRecording(recording.salaId, recording.id);
        return true;
      } catch {
        return false;
      }
    });
    if (deleted) {
      toast.success(t("telemedicina.recording_remote_deleted"));
      await loadRemoteRecordings();
    } else {
      toast.error(t("telemedicina.recording_error_remote-delete-failed"));
    }
  };

  const remoteIdsFromLocal = new Set<string>();
  for (const recording of recordings) {
    if (recording.remoteId) remoteIdsFromLocal.add(recording.remoteId);
  }
  const remoteOnlyRecordings = remoteRecordings.filter((recording) => !remoteIdsFromLocal.has(recording.id));
  const hasAnyRecordings = recordings.length > 0 || remoteOnlyRecordings.length > 0;

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
            {isSaving && <span className="text-xs text-muted-foreground">{t("telemedicina.recording_encrypting")}</span>}
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

      <div className="border-t p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">{t("telemedicina.recordings_title")}</p>
            <p className="text-xs text-muted-foreground">
              {t("telemedicina.recordings_desc", { local: recordings.length, remote: remoteRecordings.length })}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefreshRecordings} disabled={remoteLoading}>
            <RefreshCw className={cn("mr-1 h-3.5 w-3.5", remoteLoading && "animate-spin")} />
            {t("common.refresh")}
          </Button>
        </div>

        {remoteError && <p className="mb-2 text-xs text-destructive">{t("telemedicina.recording_remote_error")}</p>}
        {!hasAnyRecordings ? (
          <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
            {t("telemedicina.recordings_empty")}
          </p>
        ) : (
          <div className="space-y-2">
            {recordings.map((recording, index) => (
              <div key={recording.id} className="rounded-lg border bg-muted/20 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{t("telemedicina.recording_item_title", { number: recordings.length - index })}</span>
                      <Badge variant="secondary">{t("telemedicina.recording_local_badge")}</Badge>
                      {recording.remoteId ? (
                        <Badge variant="success" className="gap-1">
                          <Cloud className="h-3 w-3" />
                          {t("telemedicina.recording_remote_badge")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <CloudOff className="h-3 w-3" />
                          {t("telemedicina.recording_local_only_badge")}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(recording.createdAt)} · {formatDuration(recording.durationMs)} · {formatBytes(recording.originalSizeBytes)} / {formatBytes(recording.encryptedSizeBytes)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => void handleDownloadRecording(recording.id)} disabled={recordingAction === `download:${recording.id}`}>
                      <Download className="mr-1 h-3.5 w-3.5" />
                      {t("telemedicina.recording_download")}
                    </Button>
                    {recording.remoteId ? (
                      <Button variant="outline" size="sm" onClick={() => void handleDeleteRemoteRecording(recording.id)} disabled={recordingAction === `remote-delete:${recording.id}`}>
                        <CloudOff className="mr-1 h-3.5 w-3.5" />
                        {t("telemedicina.recording_delete_remote")}
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => void handleUploadRecording(recording.id)} disabled={recordingAction === `upload:${recording.id}`}>
                        <Upload className="mr-1 h-3.5 w-3.5" />
                        {t("telemedicina.recording_upload_encrypted")}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void handleDeleteLocalRecording(recording.id)} disabled={recordingAction === `delete:${recording.id}`}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {t("telemedicina.recording_delete_local")}
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {remoteOnlyRecordings.map((recording) => (
              <div key={recording.id} className="rounded-lg border border-info/30 bg-info/5 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{t("telemedicina.recording_remote_item_title")}</span>
                      <Badge variant="info" className="gap-1">
                        <Cloud className="h-3 w-3" />
                        {t("telemedicina.recording_remote_only_badge")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(recording.createdAt)} · {formatDuration(recording.durationMs)} · {formatBytes(recording.originalSizeBytes)} / {formatBytes(recording.encryptedSizeBytes)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => void handleDownloadRemoteRecording(recording)} disabled={recordingAction === `remote-download:${recording.id}`}>
                      <Download className="mr-1 h-3.5 w-3.5" />
                      {t("telemedicina.recording_download_encrypted")}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void handleDeleteRemoteOnlyRecording(recording)} disabled={recordingAction === `remote-only-delete:${recording.id}`}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {t("telemedicina.recording_delete_remote")}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("telemedicina.recording_consent_title")}</DialogTitle>
            <DialogDescription>{t("telemedicina.recording_consent_desc")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
            <Checkbox
              id="recording-consent"
              checked={consentAccepted}
              onCheckedChange={(checked) => setConsentAccepted(checked === true)}
            />
            <Label htmlFor="recording-consent" className="text-sm leading-relaxed">
              {t("telemedicina.recording_consent_checkbox")}
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConsentOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={confirmRecordingConsent} disabled={!consentAccepted}>
              {t("telemedicina.start_recording")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
