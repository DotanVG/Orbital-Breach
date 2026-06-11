import { describe, expect, it } from "vitest";
import { ObjectPool } from "../client/src/util/pool";

describe("ObjectPool", () => {
  it("uses the factory when the pool is empty", () => {
    const pool = new ObjectPool<{ n: number }>();
    let built = 0;
    const item = pool.acquire(() => ({ n: ++built }));
    expect(item).toEqual({ n: 1 });
    expect(built).toBe(1);
  });

  it("reuses released items instead of calling the factory", () => {
    const pool = new ObjectPool<{ n: number }>();
    let built = 0;
    const factory = () => ({ n: ++built });

    const first = pool.acquire(factory);
    pool.release(first);
    const second = pool.acquire(factory);

    expect(second).toBe(first);
    expect(built).toBe(1);
  });

  it("hands back released items in LIFO order", () => {
    const pool = new ObjectPool<string>();
    pool.release("a");
    pool.release("b");
    expect(pool.acquire(() => "new")).toBe("b");
    expect(pool.acquire(() => "new")).toBe("a");
    expect(pool.acquire(() => "new")).toBe("new");
  });
});
