import type { ConfigXmlBasename } from "./discovery.js";
import { handleCronGroupsXml, handleCrontabXml } from "./handlers/cron-xml.js";
import { handleDiXml } from "./handlers/di-xml.js";
import { handleEventsXml } from "./handlers/events-xml.js";
import type { XmlHandler } from "./types.js";

const handlers: Record<ConfigXmlBasename, XmlHandler> = {
  "di.xml": handleDiXml,
  "events.xml": handleEventsXml,
  "crontab.xml": handleCrontabXml,
  "cron_groups.xml": handleCronGroupsXml
};

export function getXmlHandler(basename: ConfigXmlBasename): XmlHandler {
  return handlers[basename];
}
