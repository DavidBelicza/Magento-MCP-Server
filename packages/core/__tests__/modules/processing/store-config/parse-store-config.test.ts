import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { buildConfigDescriptions } from "../../../../src/modules/processing/store-config/build-config-descriptions";
import { mergeStoreConfig } from "../../../../src/modules/processing/store-config/merge-store-config";
import { readStoreConfigSources } from "../../../../src/modules/processing/store-config/read-store-config-sources";
import type { ConfigFieldDescription } from "../../../../src/modules/processing/store-config/types";

const fixturesRoot = fileURLToPath(new URL("./fixtures", import.meta.url));

type ProjectedDescription = Pick<ConfigFieldDescription, "path" | "description" | "configPath" | "comment">;

function project(description: ConfigFieldDescription): ProjectedDescription {
  return {
    path: description.path,
    description: description.description,
    configPath: description.configPath,
    comment: description.comment
  };
}

describe("store-config parsing", () => {
  let byPath: Record<string, ConfigFieldDescription>;

  beforeAll(async () => {
    const sources = await readStoreConfigSources(fixturesRoot);
    const descriptions = buildConfigDescriptions(mergeStoreConfig(sources));
    byPath = Object.fromEntries(descriptions.map((description) => [description.path, description]));
  });

  it("describes a simple field and appends its comment to the description", () => {
    expect(project(byPath["payment_demo/settings/api_gateway"])).toEqual({
      path: "payment_demo/settings/api_gateway",
      description:
        "The API Gateway setting can be found in the store configuration, under the Acme tab, Payment Methods section, and the Settings group. Set API gateway here, only for production.",
      configPath: null,
      comment: "Set API gateway here, only for production."
    });
  });

  it("keeps the structural path as the id but records the explicit config_path", () => {
    expect(project(byPath["payment_demo/settings/mode"])).toEqual({
      path: "payment_demo/settings/mode",
      description:
        "The Mode setting can be found in the store configuration, under the Acme tab, Payment Methods section, and the Settings group.",
      configPath: "acme_demo/integration/mode",
      comment: null
    });
  });

  it("lists nested groups in order in the breadcrumb", () => {
    expect(project(byPath["payment_demo/settings/advanced/timeout"])).toEqual({
      path: "payment_demo/settings/advanced/timeout",
      description:
        "The Timeout setting can be found in the store configuration, under the Acme tab, Payment Methods section, and the Settings, Advanced group.",
      configPath: null,
      comment: null
    });
  });

  it("merges an inline <include path=...> fragment into the section", () => {
    expect(project(byPath["payment_demo/notifications/webhook_url"])).toEqual({
      path: "payment_demo/notifications/webhook_url",
      description:
        "The Webhook URL setting can be found in the store configuration, under the Acme tab, Payment Methods section, and the Notifications group. The URL that receives event notifications.",
      configPath: null,
      comment: "The URL that receives event notifications."
    });
  });

  it("merges a section-level include fragment from another module, resolving its tab", () => {
    expect(project(byPath["reporting/general/enabled"])).toEqual({
      path: "reporting/general/enabled",
      description:
        "The Enabled setting can be found in the store configuration, under the Acme tab, Reporting section, and the General group.",
      configPath: null,
      comment: null
    });
  });

  it("produces exactly the five leaf fields and no intermediate nodes", () => {
    expect(Object.keys(byPath).sort()).toEqual([
      "payment_demo/notifications/webhook_url",
      "payment_demo/settings/advanced/timeout",
      "payment_demo/settings/api_gateway",
      "payment_demo/settings/mode",
      "reporting/general/enabled"
    ]);
  });
});
