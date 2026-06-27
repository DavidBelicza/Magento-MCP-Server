import type { ConfigFieldDescription, StoreConfig, StoreConfigNode } from "./types.js";

export function buildConfigDescriptions(storeConfig: StoreConfig): ConfigFieldDescription[] {
  const descriptions: ConfigFieldDescription[] = [];

  for (const [id, section] of Object.entries(storeConfig.sections)) {
    const tabKey = section.tab?.trim() || null;
    const tabLabel = tabKey ? storeConfig.tabs[tabKey] ?? tabKey : null;

    collect({ [id]: section }, [], [], tabLabel, descriptions);
  }

  return descriptions;
}

function collect(
  nodes: Record<string, StoreConfigNode>,
  labelChain: string[],
  idChain: string[],
  tab: string | null,
  result: ConfigFieldDescription[]
): void {
  for (const [id, node] of Object.entries(nodes)) {
    const label = node.label?.trim() || "";
    const nextLabels = label ? [...labelChain, label] : [...labelChain];
    const nextIds = [...idChain, id];

    if (Object.keys(node.children).length > 0) {
      collect(node.children, nextLabels, nextIds, tab, result);
      continue;
    }

    if (nextLabels.length < 2 || !tab) {
      continue;
    }

    result.push({
      path: nextIds.join("/"),
      description: describe(nextLabels, tab, node.comment),
      configPath: node.configPath,
      comment: node.comment,
      sourceFile: node.sourceFile
    });
  }
}

function describe(labelChain: string[], tab: string, comment: string | null): string {
  const field = labelChain[labelChain.length - 1];
  const section = labelChain[0];
  const groups = labelChain.slice(1, -1);
  const groupText = groups.length > 0 ? `, and the ${groups.join(", ")} group` : "";
  const location = `The ${field} setting can be found in the store configuration, under the ${tab} tab, ${section} section${groupText}.`;

  return comment ? `${location} ${comment}` : location;
}
