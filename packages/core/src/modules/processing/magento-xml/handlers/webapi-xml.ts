import { asArray, normalizeFqn, stringValue } from "../parse-xml.js";
import { createRecordBuilder, type RecordBuilder } from "../record-builder.js";
import type { ParsedXml, XmlHandler } from "../types.js";

const webapiRouteLabel = "WebapiRoute";
const phpMethodLabel = "PHPMethod";

export const handleWebapiXml: XmlHandler = (relativePath, _area, parsed) => {
  const routes = (parsed.routes ?? {}) as ParsedXml;
  const builder = createRecordBuilder(null, relativePath);

  for (const route of asArray(routes.route as ParsedXml | ParsedXml[] | undefined)) {
    collectRoute(builder, route);
  }

  return builder.build();
};

function collectRoute(builder: RecordBuilder, route: ParsedXml): void {
  const url = stringValue(route["@_url"]);
  const httpMethod = stringValue(route["@_method"]);

  if (url === "" || httpMethod === "") {
    return;
  }

  builder.addNode({ label: webapiRouteLabel, id: url, fields: { url } });

  const secure = stringValue(route["@_secure"]) === "true";
  const soapOperation = stringValue(route["@_soapOperation"]);

  for (const service of asArray(route.service as ParsedXml | ParsedXml[] | undefined)) {
    collectService(builder, service, url, httpMethod, secure, soapOperation);
  }
}

function collectService(
  builder: RecordBuilder,
  service: ParsedXml,
  url: string,
  httpMethod: string,
  secure: boolean,
  soapOperation: string
): void {
  const serviceClass = normalizeFqn(service["@_class"]);
  const method = stringValue(service["@_method"]);

  if (serviceClass === "" || method === "") {
    return;
  }

  const methodId = `${serviceClass}::${method}`;

  builder.anchor(methodId, phpMethodLabel);
  builder.addEdge("SERVED_BY", url, webapiRouteLabel, methodId, phpMethodLabel, httpMethod, {
    httpMethod,
    ...(secure ? { secure: true } : {}),
    ...(soapOperation ? { soapOperation } : {})
  });
}
