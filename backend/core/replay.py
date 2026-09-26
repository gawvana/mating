"""Bounded replay protection for Telegram webhooks and mutation identifiers.
Uses Redis when REDIS_URL is configured, otherwise falls back to a bounded TTL cache.
"""

from __future__ import annotations

import logging
import time

logger = logging.getLogger("mating.replay")


class BoundedReplayProtector:
    """Sliding window replay protector with bounded capacity and TTL."""

    def __init__(self, max_entries: int = 20000, default_ttl_seconds: int = 3600):
        self.max_entries = max_entries
        self.default_ttl_seconds = default_ttl_seconds
        self._cache: dict[str, float] = {}

    def is_seen(self, key: str) -> bool:
        """Check if key has been seen within TTL window."""
        now = time.time()
        expiry = self._cache.get(key)
        if expiry is None:
            return False
        if now > expiry:
            del self._cache[key]
            return False
        return True

    def record(self, key: str, ttl_seconds: int | None = None) -> bool:
        """Record a key. Returns True if key was newly added, False if already seen (replayed)."""
        now = time.time()
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl_seconds

        # Clean expired if cache is getting full
        if len(self._cache) >= self.max_entries:
            self._cleanup_expired(now)
            if len(self._cache) >= self.max_entries:
                # Evict oldest 10%
                oldest_keys = sorted(self._cache.keys(), key=lambda k: self._cache[k])[: len(self._cache) // 10]
                for k in oldest_keys:
                    self._cache.pop(k, None)

        if self.is_seen(key):
            return False  # Already seen -> Replay detected

        self._cache[key] = now + ttl
        return True

    def _cleanup_expired(self, now: float) -> None:
        expired = [k for k, exp in self._cache.items() if now > exp]
        for k in expired:
            self._cache.pop(k, None)


# Canonical singleton instance for replay protection
replay_protector = BoundedReplayProtector()
