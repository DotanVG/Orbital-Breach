import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function pkg(name: "client" | "server"): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} {
  return JSON.parse(readFileSync(new URL(`../${name}/package.json`, import.meta.url), "utf8"));
}

describe("dependency cleanup", () => {
  it("drops unused client packages and keeps TypeScript tooling in devDependencies", () => {
    const client = pkg("client");
    expect(client.dependencies["colyseus.js"]).toBeUndefined();
    expect(client.dependencies.typescript).toBeUndefined();
    expect(client.dependencies["@types/three"]).toBeUndefined();
    expect(client.devDependencies.typescript).toBeTruthy();
    expect(client.devDependencies["@types/three"]).toBeTruthy();
    expect(client.dependencies["@colyseus/sdk"]).toBeTruthy();
  });

  it("drops the unused cors package and keeps the server TypeScript tooling in devDependencies", () => {
    const server = pkg("server");
    expect(server.dependencies.cors).toBeUndefined();
    expect(server.devDependencies["@types/cors"]).toBeUndefined();
    expect(server.dependencies.typescript).toBeUndefined();
    expect(server.dependencies["ts-node-dev"]).toBeUndefined();
    expect(server.devDependencies.typescript).toBeTruthy();
    expect(server.devDependencies["ts-node-dev"]).toBeTruthy();
  });
});
