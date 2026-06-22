import { asArray, normalizeFqn, stringValue } from "../parse-xml.js";
import { createRecordBuilder, type RecordBuilder } from "../record-builder.js";
import type { ParsedXml, XmlHandler } from "../types.js";

const eventLabel = "Symbol:XML:Event";

export const handleEventsXml: XmlHandler = (relativePath, area, parsed) => {
  const config = (parsed.config ?? {}) as ParsedXml;
  const builder = createRecordBuilder(area, relativePath);

  for (const event of asArray(config.event as ParsedXml | ParsedXml[] | undefined)) {
    collectEvent(builder, event);
  }

  return builder.build();
};

function collectEvent(builder: RecordBuilder, event: ParsedXml): void {
  const eventName = stringValue(event["@_name"]);

  if (eventName === "") {
    return;
  }

  builder.addNode({
    label: eventLabel,
    id: eventName,
    fields: { name: eventName, kind: "event" }
  });

  for (const observer of asArray(event.observer as ParsedXml | ParsedXml[] | undefined)) {
    collectObserver(builder, observer, eventName);
  }
}

function collectObserver(builder: RecordBuilder, observer: ParsedXml, eventName: string): void {
  const instance = normalizeFqn(observer["@_instance"]);

  if (instance === "") {
    return;
  }

  const observerName = stringValue(observer["@_name"]);
  const disabled = stringValue(observer["@_disabled"]) === "true";

  builder.anchor(instance);
  builder.addEdge("OBSERVES", instance, eventName, observerName, { observerName, disabled });
}
