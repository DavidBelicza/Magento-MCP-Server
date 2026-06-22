export type MagentoArea =
  | "global"
  | "frontend"
  | "adminhtml"
  | "crontab"
  | "webapi_rest"
  | "webapi_soap"
  | "graphql"
  | "setup";

export type ConfigXmlBasename = "di.xml";

export type ConfigXmlClassification = {
  basename: ConfigXmlBasename;
  area: MagentoArea;
};

const configXmlBasenames = new Set<string>(["di.xml"]);

const areaDirectories = new Set<string>([
  "frontend",
  "adminhtml",
  "crontab",
  "webapi_rest",
  "webapi_soap",
  "graphql",
  "setup"
]);

export function classifyConfigXml(path: string): ConfigXmlClassification | null {
  const segments = path.split("/").filter((segment) => segment !== "");
  const basename = segments[segments.length - 1];

  if (basename === undefined || !configXmlBasenames.has(basename)) {
    return null;
  }

  const parent = segments[segments.length - 2];
  const grandparent = segments[segments.length - 3];

  if (parent === "etc") {
    return { basename: basename as ConfigXmlBasename, area: "global" };
  }

  if (grandparent === "etc" && parent !== undefined && areaDirectories.has(parent)) {
    return { basename: basename as ConfigXmlBasename, area: parent as MagentoArea };
  }

  return null;
}

export function isConfigXml(path: string): boolean {
  return classifyConfigXml(path) !== null;
}
