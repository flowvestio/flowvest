(function () {
  window.STATE = {
    provider: null,
    signer: null,
    // Dedicated read-only provider to avoid wallet RPC rate limits
    readProvider: null,
    account: null,
    chainId: null,

    flow: null,
    usdc: null,
    // Read-only contract instances (use C.RPC_URL)
    readFlow: null,
    readUsdc: null,

    isConnecting: false,
    isBusy: false,
    isClaiming: false,
    lastTxHash: null,

    // Claim precompute (to keep wallet popups user-gesture friendly)
    claimableVestIds: [],
    claimablePreparedAt: 0,
    claimablePreparing: false,
    claimablePreparePromise: null,
    // If RPC calls get rate-limited, pause claimable precompute temporarily.
    claimableRateLimitedUntil: 0,

    // After a successful claim, Scan API can lag ~few seconds still showing old claimable.
    // Until it catches up (or this timestamp passes), UI shows "syncing" instead of stale amounts.
    postClaimStaleGuardUntil: 0
  };
})();
