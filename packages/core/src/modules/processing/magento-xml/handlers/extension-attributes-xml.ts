import { asArray, normalizeFqn, stringValue } from "../parse-xml.js";
import { createRecordBuilder, type RecordBuilder } from "../record-builder.js";
import type { ParsedXml, XmlHandler } from "../types.js";

const phpClassLabel = "PHPClass";
const extensionAttributeLabel = "ExtensionAttribute";

export const handleExtensionAttributesXml: XmlHandler = (relativePath, _area, parsed) => {
  const config = (parsed.config ?? {}) as ParsedXml;
  const builder = createRecordBuilder(null, relativePath);

  for (const extension of asArray(config.extension_attributes as ParsedXml | ParsedXml[] | undefined)) {
    collectExtension(builder, extension);
  }

  return builder.build();
};

function collectExtension(builder: RecordBuilder, extension: ParsedXml): void {
  const forId = normalizeFqn(extension["@_for"]);

  if (forId === "") {
    return;
  }

  builder.anchor(forId, phpClassLabel);

  for (const attribute of asArray(extension.attribute as ParsedXml | ParsedXml[] | undefined)) {
    collectAttribute(builder, attribute, forId);
  }
}

function collectAttribute(builder: RecordBuilder, attribute: ParsedXml, forId: string): void {
  const code = stringValue(attribute["@_code"]);
  const rawType = stringValue(attribute["@_type"]);

  if (code === "" || rawType === "") {
    return;
  }

  const isArray = rawType.endsWith("[]");
  const baseType = normalizeFqn(rawType.replace(/\[\]$/, ""));
  const classLike = baseType.includes("\\");
  const attributeId = `${forId}::${code}`;

  builder.addNode({
    label: extensionAttributeLabel,
    id: attributeId,
    fields: { code, is_array: isArray, ...(classLike ? {} : { type: baseType }) }
  });
  builder.addEdge("HAS_EXTENSION_ATTRIBUTE", forId, phpClassLabel, attributeId, extensionAttributeLabel, "");

  if (classLike) {
    builder.anchor(baseType, phpClassLabel);
    builder.addEdge("OF_TYPE", attributeId, extensionAttributeLabel, baseType, phpClassLabel, "");
  }
}
