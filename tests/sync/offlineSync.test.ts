import { createOfflineSyncManager } from "../../src/sync/offlineSync";

describe("offline sync manager", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("queues actions while offline and flushes them once connectivity returns", async () => {
    const onSync = jest.fn().mockResolvedValue(undefined);
    const manager = createOfflineSyncManager({
      storageKey: "test-sync",
      isOnline: () => false,
      onSync,
    });

    const queued = manager.queueAction({
      type: "deposit",
      payload: { amount: "10" },
    });

    expect(queued.status).toBe("queued");
    expect(manager.getPendingActions()).toHaveLength(1);

    manager.setOnline(true);
    await manager.flushPendingActions();

    expect(onSync).toHaveBeenCalledTimes(1);
    expect(manager.getPendingActions()[0].status).toBe("synced");
  });

  it("retries a failed action and syncs it on the next flush", async () => {
    const onConflict = jest.fn();
    const onSync = jest
      .fn()
      .mockRejectedValueOnce(new Error("Temporary network failure"))
      .mockResolvedValueOnce(undefined);

    const manager = createOfflineSyncManager({
      storageKey: "test-sync-retry",
      isOnline: () => true,
      onSync,
      onConflict,
    });

    manager.queueAction({
      type: "withdraw",
      payload: { amount: "3" },
    });

    await manager.flushPendingActions();

    let [pending] = manager.getPendingActions();
    expect(pending.status).toBe("queued");
    expect(pending.attempts).toBe(1);
    expect(onConflict).toHaveBeenCalledTimes(1);

    await manager.flushPendingActions();

    [pending] = manager.getPendingActions();
    expect(onSync).toHaveBeenCalledTimes(2);
    expect(pending.status).toBe("synced");
  });

  it("marks conflicts after the retry budget is exhausted", async () => {
    const onConflict = jest.fn();
    const manager = createOfflineSyncManager({
      storageKey: "test-sync-conflicts",
      isOnline: () => true,
      onSync: jest.fn().mockRejectedValue(new Error("Conflict detected")),
      onConflict,
    });

    manager.queueAction({
      type: "withdraw",
      payload: { amount: "3" },
    });

    await manager.flushPendingActions();
    await manager.flushPendingActions();
    await manager.flushPendingActions();

    const [pending] = manager.getPendingActions();
    expect(pending.status).toBe("conflict");
    expect(pending.attempts).toBe(3);
    expect(onConflict).toHaveBeenCalledTimes(3);
  });
});
