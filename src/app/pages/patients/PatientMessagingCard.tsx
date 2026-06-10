import * as React from "react";
import { useTranslation } from "react-i18next";
import { MessageCircle, Send } from "lucide-react";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { Textarea } from "@components/ui/textarea";
import {
  listProfessionalMessages,
  sendProfessionalMessage,
  markMessageAsRead,
  type PortalMessage,
} from "@services/api/patientPortalApi";

export function PatientMessagingCard({ patientId }: { patientId: string }) {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = React.useState<PortalMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const loadMessages = React.useCallback(async () => {
    try {
      const msgs = await listProfessionalMessages(patientId);
      setMessages(msgs);
      const unreadIds = msgs
        .filter((m) => m.direction === "patient_to_professional" && !m.readAt)
        .map((m) => m.id);
      for (const id of unreadIds) {
        markMessageAsRead(id).catch(() => {});
      }
    } catch { /* ignore */ }
  }, [patientId]);

  React.useEffect(() => {
    setLoading(true);
    loadMessages().finally(() => setLoading(false));
    const interval = setInterval(() => void loadMessages(), 30_000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const msg = await sendProfessionalMessage(patientId, text);
      setMessages((prev) => [...prev, msg]);
      setInput("");
    } catch {
      // Error toast could be added
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
