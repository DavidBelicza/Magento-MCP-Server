import type { GraphFieldValue } from "../../../graph/types.js";
import { asArray, normalizeFqn, stringValue } from "../parse-xml.js";
import { createRecordBuilder, type RecordBuilder } from "../record-builder.js";
import type { ParsedXml, XmlHandler } from "../types.js";

const phpMethodLabel = "PHPMethod";
const cronGroupLabel = "CronGroup";

export const handleCrontabXml: XmlHandler = (relativePath, area, parsed) => {
  const config = (parsed.config ?? {}) as ParsedXml;
  const builder = createRecordBuilder(area, relativePath);

  for (const group of asArray(config.group as ParsedXml | ParsedXml[] | undefined)) {
    collectJobs(builder, group);
  }

  return builder.build();
};

export const handleCronGroupsXml: XmlHandler = (relativePath, area, parsed) => {
  const config = (parsed.config ?? {}) as ParsedXml;
  const builder = createRecordBuilder(area, relativePath);

  for (const group of asArray(config.group as ParsedXml | ParsedXml[] | undefined)) {
    collectGroupSettings(builder, group);
  }

  return builder.build();
};

function collectJobs(builder: RecordBuilder, group: ParsedXml): void {
  const groupId = stringValue(group["@_id"]);

  if (groupId === "") {
    return;
  }

  addGroupNode(builder, groupId, {});

  for (const job of asArray(group.job as ParsedXml | ParsedXml[] | undefined)) {
    collectJob(builder, job, groupId);
  }
}

function collectJob(builder: RecordBuilder, job: ParsedXml, groupId: string): void {
  const instance = normalizeFqn(job["@_instance"]);
  const method = stringValue(job["@_method"]);

  if (instance === "" || method === "") {
    return;
  }

  const methodId = `${instance}::${method}`;
  const jobName = stringValue(job["@_name"]);
  const schedule = stringValue(job.schedule);

  builder.anchor(methodId, phpMethodLabel);
  builder.addEdge("SCHEDULED_IN", methodId, phpMethodLabel, groupId, cronGroupLabel, jobName, {
    jobName,
    schedule
  });
}

function collectGroupSettings(builder: RecordBuilder, group: ParsedXml): void {
  const groupId = stringValue(group["@_id"]);

  if (groupId === "") {
    return;
  }

  addGroupNode(builder, groupId, scalarSettings(group));
}

function addGroupNode(builder: RecordBuilder, groupId: string, settings: Record<string, GraphFieldValue>): void {
  builder.addNode({
    label: cronGroupLabel,
    id: groupId,
    fields: { name: groupId, kind: "cronGroup", ...settings }
  });
}

function scalarSettings(group: ParsedXml): Record<string, GraphFieldValue> {
  const settings: Record<string, GraphFieldValue> = {};

  for (const [key, value] of Object.entries(group)) {
    if (key.startsWith("@_")) {
      continue;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      settings[key] = value;
    }
  }

  return settings;
}
