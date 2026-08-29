import React from "react";
import {
  act,
  renderHook,
} from "@testing-library/react";

import {
  WalletProvider,
  useWallet,
} from "../../src/contexts/WalletContext";

import * as walletService from "../../src/services/walletService";

jest.mock(
  "../../src/services/walletService",
  () => ({
    getAvailableWallets: jest.fn(() => []),
    connectWallet: jest.fn(),
    disconnectWallet: jest
      .fn()
      .mockResolvedValue(undefined),
    switchWallet: jest.fn(),
    restoreSession: jest
      .fn()
      .mockResolvedValue(null),
    pollSession: jest
      .fn()
      .mockResolvedValue(null),
  }),
);

jest.mock(
  "../../src/utils/notifications",
  () => ({
    notify: {
      success: jest.fn(),
      error: jest.fn(),
    },
  }),
);

jest.mock(
  "../../src/observability/diagnostics",
  () => ({
    emit: jest.fn(),
  }),
);

jest.mock(
  "../../src/utils/enhancedApiClient",
  () => ({
    apiGet: jest.fn().mockResolvedValue({
      success: true,
      data: {
        balances: [],
      },
    }),
  }),
);

describe("WalletContext wallet switching", () => {
  const walletA = {
    address:
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    network: "testnet",
    walletType: "freighter",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    delete (window as any).__MOCK_WALLET_CONTEXT__;

    (
      walletService.getAvailableWallets as jest.Mock
    ).mockReturnValue([]);

    (
      walletService.restoreSession as jest.Mock
    ).mockResolvedValue(null);

    (
      walletService.pollSession as jest.Mock
    ).mockResolvedValue(null);
  });

  afterEach(() => {
    delete (window as any).__MOCK_WALLET_CONTEXT__;
  });

  test(
    "preserves the current wallet state when switching wallets fails",
    async () => {
      (window as any).__MOCK_WALLET_CONTEXT__ = {
        address: walletA.address,
        network: walletA.network,
        balance: "100.0",
        isConnecting: false,
        error: null,
        walletType: walletA.walletType,
      };

      (
        walletService.switchWallet as jest.Mock
      ).mockRejectedValue(
        new Error("User rejected wallet connection"),
      );

      const wrapper = ({
        children,
      }: {
        children: React.ReactNode;
      }) => (
        <WalletProvider>
          {children}
        </WalletProvider>
      );

      const { result } = renderHook(
        () => useWallet(),
        {
          wrapper,
        },
      );

      expect(result.current.address).toBe(
        walletA.address,
      );

      expect(result.current.walletType).toBe(
        "freighter",
      );

      expect(result.current.isConnected).toBe(
        true,
      );

      await act(async () => {
        await result.current.switchWallet(
          "albedo",
        );
      });

      expect(
        walletService.switchWallet,
      ).toHaveBeenCalledWith(
        "freighter",
        "albedo",
      );

      expect(result.current.address).toBe(
        walletA.address,
      );

      expect(result.current.walletType).toBe(
        "freighter",
      );

      expect(result.current.isConnected).toBe(
        true,
      );

      expect(
        result.current.isConnecting,
      ).toBe(false);

      expect(result.current.error).toBe(
        "User rejected wallet connection",
      );
    },
  );
});
