// In dev, Vite proxies /ws → ws://localhost:3001 (vite.config.ts).
// In production, VITE_WS_URL must be set to the Railway server URL (e.g. wss://your-app.railway.app).
const WS_URL = import.meta.env.VITE_WS_URL ?? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

export class NetClient {
  public connect(): void {
    // TODO: connect to the multiplayer server.
    // Use WS_URL when implementing (Feature 5).
    void WS_URL;
  }
}
