import React from "react";
import { render } from "ink";
import { StatusTui } from "./app/tui";

const DEFAULT_INTERVAL = 30 as const;

function parseInterval(args: string[]): 10 | 30 | 60 {
  const flagIndex = args.findIndex((arg) => arg === "--interval" || arg === "-i");
  if (flagIndex === -1) return DEFAULT_INTERVAL;
  const value = args[flagIndex + 1];
  const parsed = Number(value);
  if (parsed === 10 || parsed === 30 || parsed === 60) {
    return parsed;
  }
  return DEFAULT_INTERVAL;
}

const interval = parseInterval(process.argv.slice(2));

render(<StatusTui refreshInterval={interval} />);
