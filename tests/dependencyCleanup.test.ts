import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function pkg(name: "client" | "server"): {
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
} {
  return JSON.parse(readFileSync(new URL(`../${name}/package.json`, import.meta.url), "utf8"));
}

describe("dependency cleanup", () => {
  it("drops unused client packages and keeps the production build tools installed", () => {
    const client = pkg("client");
    expect(client.dependencies["colyseus.js"]).toBeUndefined();
    expect(client.dependencies.typescript).toBeTruthy();
    expect(client.dependencies["@types/three"]).toBeTruthy();
    expect(client.dependencies["@types/qrcode"]).toBeTruthy();
    expect(client.dependencies.vite).toBeTruthy();
    expect(client.dependencies["@colyseus/sdk"]).toBeTruthy();
    expect(client.devDependencies?.typescript).toBeUndefined();
  });

  it("drops unused server packages and keeps tsc available in a production install", () => {
    const server = pkg("server");
    expect(server.dependencies.cors).toBeUndefined();
    expect(server.dependencies.typescript).toBeTruthy();
    expect(server.dependencies["@types/node"]).toBeTruthy();
    expect(server.dependencies["@types/express"]).toBeTruthy();
    expect(server.devDependencies?.["@types/cors"]).toBeUndefined();
    expect(server.devDependencies?.typescript).toBeUndefined();
    expect(server.devDependencies?.["ts-node-dev"]).toBeTruthy();
  });
});
