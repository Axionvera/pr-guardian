import {
  cacheAnalytics,
  cacheBalances,
  cacheSyncQueue,
  cacheTransactions,
  getCachedAnalytics,
  getCachedBalances,
  getCachedSyncQueue,
  getCachedTransactions,
  OFFLINE_CACHE_TTL_MS,
} from "../../src/cache/offlineCache";

const walletAddress = "GPRG02CACHEWALLET";

const balances: Parameters<typeof cacheBalances>[1] = {
  balance: "123.4567",
  rewards: "9.99",
};

const transactions: Parameters<typeof cacheTransactions>[1] = [
  {
    id: "tx-prg02-1",
    type: "deposit",
    amount: "100",
    status: "success",
    createdAt: "2026-08-29T00:00:00.000Z",
  },
];

const analytics: Parameters<typeof cacheAnalytics>[1] = {
  historicalBalances: [
    {
      timestamp: "2026-08-29T00:00:00.000Z",
      balance: "123.4567",
      rewards: "9.99",
    },
  ],
  rewardPerformance: {
    totalRewardsEarned: "9.99",
    averageRewardRate: "5.2",
    lastRewardDate: "2026-08-29T00:00:00.000Z",
  },
  participationMetrics: {
    totalDeposits: "100",
    totalWithdrawals: "0",
    netDeposits: "100",
    transactionCount: 1,
    firstInteractionDate: "2026-08-29T00:00:00.000Z",
    lastInteractionDate: "2026-08-29T00:00:00.000Z",
    activeDays: 1,
  },
};

describe("offline cache TTL", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-29T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
    localStorage.clear();
  });

  it("returns fresh cached vault data before the TTL expires", () => {
    cacheBalances(walletAddress, balances);
    cacheTransactions(walletAddress, transactions);
    cacheAnalytics(walletAddress, analytics);

    jest.setSystemTime(new Date(Date.now() + OFFLINE_CACHE_TTL_MS - 1));

    expect(getCachedBalances(walletAddress)).toEqual(balances);
    expect(getCachedTransactions(walletAddress)).toEqual(transactions);
    expect(getCachedAnalytics(walletAddress)).toEqual(analytics);
  });

  it("returns null and removes stale vault data after the TTL expires", () => {
    cacheBalances(walletAddress, balances);
    cacheTransactions(walletAddress, transactions);
    cacheAnalytics(walletAddress, analytics);

    jest.setSystemTime(new Date(Date.now() + OFFLINE_CACHE_TTL_MS + 1));

    expect(getCachedBalances(walletAddress)).toBeNull();
    expect(getCachedTransactions(walletAddress)).toBeNull();
    expect(getCachedAnalytics(walletAddress)).toBeNull();

    expect(localStorage.getItem(`axionvera:cache:balances:${walletAddress}`)).toBeNull();
    expect(localStorage.getItem(`axionvera:cache:transactions:${walletAddress}`)).toBeNull();
    expect(localStorage.getItem(`axionvera:cache:analytics:${walletAddress}`)).toBeNull();
  });

  it("does not expire the offline sync queue using the vault read-cache TTL", () => {
    const queue = [
      {
        id: "queued-prg02-1",
        type: "deposit",
        payload: {
          amount: "10",
        },
        status: "queued",
        createdAt: "2026-08-29T00:00:00.000Z",
      },
    ];

    cacheSyncQueue(queue);

    jest.setSystemTime(new Date(Date.now() + OFFLINE_CACHE_TTL_MS * 2));

    expect(getCachedSyncQueue()).toEqual(queue);
  });
});
