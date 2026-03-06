import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { AppState, RefreshInterval } from "./state";
import { fetchStatuses } from "./state";

const INTERVALS: RefreshInterval[] = [10, 30, 60];

function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleTimeString();
}

function formatCountdown(lastUpdatedAt: number | null, intervalSeconds: number, now: number): string {
  if (!lastUpdatedAt) return "-";
  const elapsed = Math.floor((now - lastUpdatedAt) / 1000);
  const remaining = Math.max(0, intervalSeconds - elapsed);
  return `${remaining}s`;
}

function renderMultiline(text: string): string[] {
  return text.split("\n");
}

export function StatusTui(props: { refreshInterval: RefreshInterval }) {
  const { exit } = useApp();
  const [appState, setAppState] = useState<AppState>({
    statuses: [],
    lastUpdatedAt: null,
    loading: true,
    error: undefined,
  });
  const [intervalSeconds, setIntervalSeconds] = useState<RefreshInterval>(props.refreshInterval);
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false);

  const intervalLabel = useMemo(() => `${intervalSeconds}s`, [intervalSeconds]);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setAppState((prev) => ({ ...prev, loading: true, error: undefined }));
    const next = await fetchStatuses();
    setAppState(next);
    inFlight.current = false;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      void refresh();
    }, intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [intervalSeconds, refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useInput((input, key) => {
    if (input === "q" || key.escape || (key.ctrl && input === "c")) {
      exit();
      return;
    }
    if (input === "r") {
      void refresh();
      return;
    }
    if (input === "i") {
      const currentIndex = INTERVALS.indexOf(intervalSeconds);
      const next = INTERVALS[(currentIndex + 1) % INTERVALS.length];
      setIntervalSeconds(next as RefreshInterval);
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between">
        <Text color="cyan">OpenCode Status</Text>
        <Text color="gray">
          refresh: {intervalLabel} · next in {formatCountdown(appState.lastUpdatedAt, intervalSeconds, now)}
        </Text>
      </Box>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="gray">Last update: {formatTimestamp(appState.lastUpdatedAt)}</Text>
        <Text color="gray">r=refresh · i=interval · q=quit</Text>
      </Box>

      {appState.loading && (
        <Box marginBottom={1}>
          <Text color="yellow">Loading…</Text>
        </Box>
      )}

      {appState.error && (
        <Box marginBottom={1}>
          <Text color="red">{appState.error}</Text>
        </Box>
      )}

      {appState.statuses.map((status, idx) => (
        <Box key={status.key} flexDirection="column" marginBottom={idx === appState.statuses.length - 1 ? 0 : 1}>
          <Text color="green">## {status.title}</Text>
          {status.result?.success && status.result.output && (
            <Box flexDirection="column">
              {renderMultiline(status.result.output).map((line, lineIndex) => (
                <Text key={`${status.key}-${lineIndex}`}>{line}</Text>
              ))}
            </Box>
          )}
          {status.result === null && (
            <Text color="gray">Not configured.</Text>
          )}
          {status.result?.success === false && status.result.error && (
            <Text color="red">{status.result.error}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}
