import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { WebSocket } from "ws";
import type { WsTicketInfo } from "../ws/websocketGateway.js";
import {
  broadcastMessageNew,
  broadcastMessageRead,
  isConnectedPacienteId,
  registerChatChannel,
} from "./chatServer.js";

function fakeWs() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    readyState: WebSocket.OPEN,
    send: vi.fn(),
    close: vi.fn(),
  }) as unknown as WebSocket & {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
}

function ticketInfo(overrides: Partial<WsTicketInfo> = {}): WsTicketInfo {
  return {
    ticketId: "t-1",
    channel: "chat",
    sub: "pat-1",
    sucursalId: "s1",
    resourceId: null,
    pacienteId: "pat-1",
    origin: "http://localhost:1420",
    ...overrides,
  };
}

describe("registerChatChannel / broadcasts", () => {
  it("delivers message:new only to clients bound to that paciente", () => {
    const patientWs = fakeWs();
    const otherPatientWs = fakeWs();
    registerChatChannel(
      patientWs,
      ticketInfo({ sub: "pat-1", pacienteId: "pat-1" }),
    );
    registerChatChannel(
      otherPatientWs,
      ticketInfo({ sub: "pat-2", pacienteId: "pat-2" }),
    );

    broadcastMessageNew("pat-1", { id: "m-1" });

    expect(patientWs.send).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(patientWs.send.mock.calls[0][0] as string) as {
      type: string;
      pacienteId: string;
      message: { id: string };
    };
    expect(payload.type).toBe("message:new");
    expect(payload.pacienteId).toBe("pat-1");
    expect(payload.message.id).toBe("m-1");
    expect(otherPatientWs.send).not.toHaveBeenCalled();

    patientWs.emit("close");
    otherPatientWs.emit("close");
  });

  it("a professional ticket for paciente X never receives events of paciente Y", () => {
    const professionalWs = fakeWs();
    registerChatChannel(
      professionalWs,
      ticketInfo({ sub: "prof-1", pacienteId: "pat-1" }),
    );

    broadcastMessageNew("pat-2", { id: "m-other" });
    expect(professionalWs.send).not.toHaveBeenCalled();

    broadcastMessageNew("pat-1", { id: "m-mine" });
    expect(professionalWs.send).toHaveBeenCalledTimes(1);

    professionalWs.emit("close");
  });

  it("broadcastMessageRead targets only the bound paciente channel", () => {
    const patientWs = fakeWs();
    const professionalWs = fakeWs();
    registerChatChannel(
      patientWs,
      ticketInfo({ sub: "pat-1", pacienteId: "pat-1" }),
    );
    registerChatChannel(
      professionalWs,
      ticketInfo({ sub: "prof-1", pacienteId: "pat-1" }),
    );

    broadcastMessageRead("pat-1", "m-1", "2026-01-01T00:00:00.000Z");

    expect(patientWs.send).toHaveBeenCalledTimes(1);
    const patientPayload = JSON.parse(
      patientWs.send.mock.calls[0][0] as string,
    ) as { type: string; messageId: string; readAt: string };
    expect(patientPayload.type).toBe("message:read");
    expect(patientPayload.messageId).toBe("m-1");
    expect(patientPayload.readAt).toBe("2026-01-01T00:00:00.000Z");
    expect(professionalWs.send).toHaveBeenCalledTimes(1);

    patientWs.emit("close");
    professionalWs.emit("close");
  });

  it("isConnectedPacienteId reflects only active bound connections", () => {
    const patientWs = fakeWs();
    registerChatChannel(
      patientWs,
      ticketInfo({ sub: "pat-1", pacienteId: "pat-1" }),
    );
    expect(isConnectedPacienteId("pat-1")).toBe(true);
    expect(isConnectedPacienteId("pat-2")).toBe(false);

    patientWs.emit("close");
    expect(isConnectedPacienteId("pat-1")).toBe(false);
  });

  it("removes the client on error", () => {
    const patientWs = fakeWs();
    registerChatChannel(
      patientWs,
      ticketInfo({ sub: "pat-1", pacienteId: "pat-1" }),
    );
    expect(isConnectedPacienteId("pat-1")).toBe(true);

    patientWs.emit("error");
    expect(isConnectedPacienteId("pat-1")).toBe(false);
  });
});
