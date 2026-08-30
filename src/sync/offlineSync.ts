export type SyncActionType = "deposit" | "withdraw" | "claim";

export interface SyncAction<T = Record<string, unknown>> {
  id: string;
  type: SyncActionType;
  payload: T;
  createdAt: string;
  status: "queued" | "syncing" | "synced" | "conflict";
  attempts: number;
}

export interface OfflineSyncManagerOptions<T = Record<string, unknown>> {
  storageKey?: string;
  isOnline: () => boolean;
  onSync: (action: SyncAction<T>) => Promise<void>;
  onConflict?: (action: SyncAction<T>, error: Error) => void;
}

const MAX_SYNC_ATTEMPTS = 3;

export function createOfflineSyncManager<T = Record<string, unknown>>({
  storageKey = "axionvera:sync:queue",
  isOnline,
  onSync,
  onConflict,
}: OfflineSyncManagerOptions<T>) {
  let isConnected = isOnline();
  let pendingActions: SyncAction<T>[] = [];
  let isFlushing = false;

  function persist() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(pendingActions));
  }

  function hydrate() {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;

    try {
      const stored = JSON.parse(raw) as SyncAction<T>[];
      pendingActions = Array.isArray(stored) ? stored : [];
    } catch {
      pendingActions = [];
    }
  }

  hydrate();

  function queueAction(action: Omit<SyncAction<T>, "id" | "createdAt" | "status" | "attempts">): SyncAction<T> {
    const queuedAction: SyncAction<T> = {
      id: `${action.type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: action.type,
      payload: action.payload,
      createdAt: new Date().toISOString(),
      status: "queued",
      attempts: 0,
    };

    pendingActions = [...pendingActions, queuedAction];
    persist();
    return queuedAction;
  }

  async function flushPendingActions() {
    if (!isConnected || isFlushing) return;

    isFlushing = true;
    try {
      const actions = pendingActions.filter((action) => {
        if (action.status === "synced") return false;
        if (action.status === "conflict" && action.attempts >= MAX_SYNC_ATTEMPTS) return false;
        return true;
      });

      if (!actions.length) return;

      for (const action of actions) {
        const index = pendingActions.findIndex((item) => item.id === action.id);
        if (index === -1) continue;

        if (pendingActions[index].status === "syncing") continue;

        pendingActions[index] = {
          ...pendingActions[index],
          status: "syncing",
          attempts: pendingActions[index].attempts + 1,
        };
        persist();

        try {
          await onSync(pendingActions[index]);
          pendingActions[index] = { ...pendingActions[index], status: "synced" };
          persist();
        } catch (error) {
          const err = error instanceof Error ? error : new Error("Sync failed");

          pendingActions[index] = {
            ...pendingActions[index],
            status: pendingActions[index].attempts >= MAX_SYNC_ATTEMPTS ? "conflict" : "queued",
          };
          persist();

          onConflict?.(pendingActions[index], err);
        }
      }
    } finally {
      isFlushing = false;
    }
  }

  function getPendingActions() {
    return pendingActions;
  }

  function setOnline(next: boolean) {
    isConnected = next;
    if (next) {
      void flushPendingActions();
    }
  }

  return {
    queueAction,
    flushPendingActions,
    getPendingActions,
    setOnline,
  };
}
