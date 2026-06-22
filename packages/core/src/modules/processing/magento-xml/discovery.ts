export type MagentoArea =
  | "global"
  | "frontend"
  | "adminhtml"
  | "crontab"
  | "webapi_rest"
  | "webapi_soap"
  | "graphql"
  | "setup";

export type ConfigXmlBasename = "di.xml" | "events.xml";

export type ConfigXmlClassification = {
  basename: ConfigXmlBasename;
  area: MagentoArea;
};

export const orderedConfigXmlBasenames: ConfigXmlBasename[] = ["di.xml", "events.xml"];

const configXmlBasenames = new Set<string>(orderedConfigXmlBasenames);

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
