type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  meta?: Record<string, unknown>;
}

function log(level: LogLevel, component: string, message: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = { timestamp: new Date().toISOString(), level, component, message, meta };
  const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${component}]`;
  if (level === "error") {
    console.error(`${prefix} ${message}`, meta ? JSON.stringify(meta) : "");
  } else if (level === "warn") {
    console.warn(`${prefix} ${message}`, meta ? JSON.stringify(meta) : "");
  } else {
    console.log(`${prefix} ${message}`, meta ? JSON.stringify(meta) : "");
  }
}

export function logAgent(agent: string, event: string, topic: string, meta?: Record<string, unknown>) {
  log("info", `ai:${agent}`, `${event} — topic="${topic}"`, meta);
}

export function logGeneration(event: string, meta?: Record<string, unknown>) {
  log("info", "ai:generation", event, meta);
}

export function logGraph(event: string, meta?: Record<string, unknown>) {
  log("info", "ai:graph", event, meta);
}

export function logError(component: string, message: string, meta?: Record<string, unknown>) {
  log("error", component, message, meta);
}

export function logWarn(component: string, message: string, meta?: Record<string, unknown>) {
  log("warn", component, message, meta);
}
