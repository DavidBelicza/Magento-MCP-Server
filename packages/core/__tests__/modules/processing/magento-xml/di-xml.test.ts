import { describe, expect, it } from "vitest";
import { handleDiXml } from "../../../../src/modules/processing/magento-xml/handlers/di-xml";
import { parseXml } from "../../../../src/modules/processing/magento-xml/parse-xml";
import type { GraphRelationshipRecord } from "../../../../src/modules/graph/types";

function records(xml: string) {
  return handleDiXml("Vendor/Module/etc/di.xml", "global", parseXml(xml));
}

function edgesOf(relationships: GraphRelationshipRecord[], type: string): GraphRelationshipRecord[] {
  return relationships.filter((relationship) => relationship.type === type);
}

describe("handleDiXml", () => {
  it("maps a preference to a PREFERENCE_FOR edge and strips a leading backslash", () => {
    const { relationships } = records(
      '<config><preference for="\\Magento\\Catalog\\Api\\RepoInterface" type="Magento\\Catalog\\Model\\Repo"/></config>'
    );
    const preferences = edgesOf(relationships, "PREFERENCE_FOR");

    expect(preferences).toHaveLength(1);
    expect(preferences[0]?.fromId).toBe("Magento\\Catalog\\Api\\RepoInterface");
    expect(preferences[0]?.toId).toBe("Magento\\Catalog\\Model\\Repo");
    expect(preferences[0]?.fields.area).toBe("global");
    expect(preferences[0]?.fields.sourceFile).toBe("Vendor/Module/etc/di.xml");
  });

  it("skips a preference missing for or type", () => {
    const { relationships } = records('<config><preference for="Only\\For"/></config>');
    expect(edgesOf(relationships, "PREFERENCE_FOR")).toHaveLength(0);
  });

  it("maps a plugin to a PLUGIN_FOR edge from the plugin class to the target", () => {
    const { relationships } = records(
      '<config><type name="Magento\\Catalog\\Model\\Repo"><plugin name="p" type="Acme\\Plugin\\RepoPlugin"/></type></config>'
    );
    const plugins = edgesOf(relationships, "PLUGIN_FOR");

    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.fromId).toBe("Acme\\Plugin\\RepoPlugin");
    expect(plugins[0]?.toId).toBe("Magento\\Catalog\\Model\\Repo");
  });

  it("maps object and array arguments to INJECTS edges with is_array set accordingly", () => {
    const { relationships } = records(
      '<config><type name="Acme\\Service">' +
        '<arguments>' +
        '<argument name="cache" xsi:type="object">Acme\\Cache\\Frontend</argument>' +
        '<argument name="handlers" xsi:type="array"><item name="h1" xsi:type="object">Acme\\Handler\\One</item></argument>' +
        '</arguments>' +
        '</type></config>'
    );
    const injects = edgesOf(relationships, "INJECTS");
    const cache = injects.find((edge) => edge.toId === "Acme\\Cache\\Frontend");
    const handler = injects.find((edge) => edge.toId === "Acme\\Handler\\One");

    expect(cache?.fields.name).toBe("cache");
    expect(cache?.fields.is_array).toBe(false);
    expect(handler?.fields.name).toBe("handlers");
    expect(handler?.fields.is_array).toBe(true);
  });

  it("creates a virtualType node and an EXTENDS edge to its base", () => {
    const { nodes, relationships } = records(
      '<config><virtualType name="virtualRepo" type="Magento\\Catalog\\Model\\Repo"/></config>'
    );
    const virtual = nodes.find((entry) => entry.id === "virtualRepo");
    const extends_ = edgesOf(relationships, "EXTENDS");

    expect(virtual?.fields.kind).toBe("virtualType");
    expect(virtual?.label).toBe("PHPClass:VirtualType");
    expect(extends_).toHaveLength(1);
    expect(extends_[0]?.fromId).toBe("virtualRepo");
    expect(extends_[0]?.toId).toBe("Magento\\Catalog\\Model\\Repo");
  });
});
