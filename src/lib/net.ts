"use client";

// Thin WebSocket client for the multiplayer server. Persists a client id in
// localStorage so a refresh can reclaim its seat mid-game.

export type ServerMessage =
  | { t: "hello"; clientId: string }
  | { t: "joined"; code: string; seat: number }
  | {
      t: "lobby";
      code: string;
      clanMode: "recommended" | "random";
      started: boolean;
      seats: { seat: number; name: string; isBot: boolean; connected: boolean; isHost: boolean }[];
    }
  | { t: "state"; state: unknown }
  | { t: "error"; msg: string };

function wsUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  if (explicit) return explicit;
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  // `next dev` serves the page on 3000 with the ws server on 3001; in
  // production one Bun process serves both the site and the websocket.
  if (window.location.port === "3000") return `${proto}://${window.location.hostname}:3001`;
  return `${proto}://${window.location.host}`;
}

function clientId(): string {
  // Per-tab identity (survives a refresh, but two tabs never share a seat).
  let id = sessionStorage.getItem("ethnos-cid");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("ethnos-cid", id);
  }
  return id;
}

export class NetClient {
  private ws: WebSocket | null = null;
  private queue: string[] = [];
  onMessage: (msg: ServerMessage) => void = () => {};
  onStatus: (status: "connecting" | "open" | "closed") => void = () => {};

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.onStatus("connecting");
    const ws = new WebSocket(`${wsUrl()}/?cid=${clientId()}`);
    this.ws = ws;
    ws.onopen = () => {
      this.onStatus("open");
      for (const raw of this.queue) ws.send(raw);
      this.queue = [];
    };
    ws.onmessage = (ev) => {
      try {
        this.onMessage(JSON.parse(ev.data) as ServerMessage);
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.onStatus("closed");
    };
    ws.onerror = () => ws.close();
  }

  send(msg: unknown) {
    const raw = JSON.stringify(msg);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(raw);
    else {
      this.queue.push(raw);
      this.connect();
    }
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }
}
