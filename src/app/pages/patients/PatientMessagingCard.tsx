import * as React from "react";
import { useTranslation } from "react-i18next";
import { MessageCircle, Send, Wifi, WifiOff } from "lucide-react";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { Textarea } from "@components/ui/textarea";
import { Badge } from "@components/ui/badge";
import {
  listProfessionalMessages,
  sendProfessionalMessage,
  markMessageAsRead,
} from "@services/api/patientPortalApi";
import { useRealtimeChat } from "@hooks/useRealtimeChat";

function getChatWsUrl(): string {
  const apiUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL ?? "http://localhost:3000";
  const base = apiUrl.replace(/^http/, "ws");
  return `${base}/ws/chat`;
}

function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem("auth-store");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string } };
    return parsed.state?.token ?? null;
  } catch {
    return null;
  }
}

export function PatientMessagingCard({ patientId }: { patientId: string }) {
  const { t, i18n } = useTranslation();
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const token = getAuthToken();

  const buildWsUrl = React.useCallback(() => {
    if (!token) return "";
    return `${getChatWsUrl()}?token=${encodeURIComponent(token)}&pacienteId=${encodeURIComponent(patientId)}`;
  }, [patientId, token]);

  const { messages, send, markAsRead, loading, isRealtime } = useRealtimeChat({
    wsUrl: buildWsUrl(),
    fetchMessages: React.useCallback(
      (signal) => listProfessionalMessages(patientId, signal),
      [patientId],
    ),
    sendMessage: React.useCallback(
      async (content: string) => { await sendProfessionalMessage(patientId, content); },
      [patientId],
    ),
    markAsRead: React.useCallback(
      async (messageId: string) => { await markMessageAsRead(messageId); },
      [],
    ),
  });

  React.useEffect(() => {
    const unreadIds = messages
      .filter((m) => m.direction === "patient_to_professional" && !m.readAt)
      .map((m) => m.id);
    for (const id of unreadIds) {
      markAsRead(id).catch((err) => { console.error("[PatientMessagingCard] Failed to mark message as read", err); });
    }
  }, [messages, markAsRead]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await send(text);
      setInput("");
    } catch (err) {
      console.error("[PatientMessagingCard] Failed to send message", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    try {
      return new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(iso));
    } catch {
      return "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageCircle className="h-4 w-4 text-primary" />
          {t("patient_portal.messages_pro_title")}
          {isRealtime ? (
            <Badge variant="outline" className="ml-auto gap-1 px-1.5 py-0 text-[10px]">
              <Wifi className="h-3 w-3 text-success" />
              {t("sync.connected")}
            </Badge>
          ) : (
            <Badge variant="outline" className="ml-auto gap-1 px-1.5 py-0 text-[10px]">
              <WifiOff className="h-3 w-3 text-warning" />
              {t("sync.disconnected")}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{t("patient_portal.messages_pro_desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex max-h-80 min-h-40 flex-col gap-2 overflow-y-auto rounded-lg border bg-muted/30 p-3">
            {loading ? (
              <Skeleton className="h-20 w-full rounded-lg" />
            ) : messages.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("patient_portal.messages_pro_empty")}
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === "professional_to_patient" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                      msg.direction === "professional_to_patient"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}
                  >
                    <p className="break-words">{msg.content}</p>
                    <p
                      className={`mt-1 text-[10px] ${
                        msg.direction === "professional_to_patient"
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatTime(msg.createdAt)}
                      {msg.direction === "patient_to_professional" && msg.readAt && " · Leído"}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("patient_portal.messages_pro_placeholder")}
              className="min-h-10 resize-none"
              rows={2}
            />
            <Button
              onClick={() => void handleSend()}
              disabled={!input.trim() || sending}
              className="self-end"
              size="sm"
            >
              {sending ? (
                t("patient_portal.messages_sending")
              ) : (
                <><Send className="mr-1 h-3 w-3" />{t("patient_portal.messages_send")}</>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
