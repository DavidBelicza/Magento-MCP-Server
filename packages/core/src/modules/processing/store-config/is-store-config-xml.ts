const systemXmlPath = "etc/adminhtml/system.xml";
const systemDirPath = "etc/adminhtml/system/";

export function isStoreConfigXml(path: string): boolean {
  const normalized = path.split("\\").join("/");

  if (normalized.endsWith(systemXmlPath)) {
    return true;
  }

  return normalized.includes(systemDirPath) && normalized.endsWith(".xml");
}
