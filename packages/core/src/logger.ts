import { pino } from "pino";
import { readConfig } from "./config.js";

const config = readConfig();

export const logger = pino({
  level: config.enableTelemetry ? "info" : "silent",
  formatters: {
    level: (label) => {
      return { level: label };
    }
  }
});
