import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type AppSettings = {
  phpVersion: string;
  analyzedSubpath: string;
};

export const phpVersionOptions = ["8.5", "8.4", "8.3", "8.2", "8.1", "8.0", "7.4"] as const;

const defaults: AppSettings = {
  phpVersion: "8.5",
  analyzedSubpath: ""
};

let current: AppSettings | null = null;

function configPath(): string {
  return process.env.MAGENTIC_CONFIG_PATH ?? "/app/data/config.json";
}

function sanitizeSubpath(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");

  if (trimmed === "" || trimmed.split("/").some((segment) => segment === "..")) {
    return "";
  }

  return trimmed;
}

function sanitizePhpVersion(value: unknown): string {
  return phpVersionOptions.includes(value as (typeof phpVersionOptions)[number])
    ? (value as string)
    : defaults.phpVersion;
}

function normalize(raw: Partial<AppSettings> | null): AppSettings {
  return {
    phpVersion: sanitizePhpVersion(raw?.phpVersion),
    analyzedSubpath: sanitizeSubpath(raw?.analyzedSubpath)
  };
}

export function loadAppSettings(): AppSettings {
  try {
    const raw = JSON.parse(readFileSync(configPath(), "utf8")) as Partial<AppSettings>;
    current = normalize(raw);
  } catch {
    current = { ...defaults };
  }

  return current;
}

export function getAppSettings(): AppSettings {
  return current ?? loadAppSettings();
}

export function updateAppSettings(patch: Partial<AppSettings>): AppSettings {
  const next = normalize({ ...getAppSettings(), ...patch });
  const path = configPath();

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  current = next;

  return next;
}
