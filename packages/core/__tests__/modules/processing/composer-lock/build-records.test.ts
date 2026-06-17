import { describe, expect, it } from "vitest";
import { buildComposerLockRecords } from "../../../../src/modules/processing/composer-lock/build-records";
import type {
  ComposerLock,
  ComposerPackage
} from "../../../../src/modules/processing/composer-lock/types";

function pkg(overrides: Partial<ComposerPackage> & { name: string }): ComposerPackage {
  return { version: "1.0.0", ...overrides };
}

function lock(packages: ComposerPackage[]): ComposerLock {
  return { packages, "packages-dev": [] };
}

describe("buildComposerLockRecords", () => {
  it("creates a node for every package, regardless of vendor", () => {
    const records = buildComposerLockRecords(
      lock([pkg({ name: "magento/module-catalog" }), pkg({ name: "acme/widget" }), pkg({ name: "psr/log" })])
    );

    expect(records.packageNodes.has("package:magento/module-catalog")).toBe(true);
    expect(records.packageNodes.has("package:acme/widget")).toBe(true);
    expect(records.packageNodes.has("package:psr/log")).toBe(true);
  });

  it("flags Magento packages and derives the module name", () => {
    const records = buildComposerLockRecords(lock([pkg({ name: "magento/module-catalog" })]));
    const fields = records.packageNodes.get("package:magento/module-catalog")?.fields;

    expect(fields?.isMagentoPackage).toBe(true);
    expect(fields?.magentoModuleName).toBe("Catalog");
  });

  it("derives a PascalCase module name for hyphenated Magento modules", () => {
    const records = buildComposerLockRecords(lock([pkg({ name: "magento/module-catalog-inventory" })]));
    const fields = records.packageNodes.get("package:magento/module-catalog-inventory")?.fields;

    expect(fields?.magentoModuleName).toBe("CatalogInventory");
  });

  it("does not flag a vanilla Composer package as Magento", () => {
    const records = buildComposerLockRecords(lock([pkg({ name: "acme/widget" })]));
    const fields = records.packageNodes.get("package:acme/widget")?.fields;

    expect(fields?.isMagentoPackage).toBe(false);
    expect(fields?.magentoModuleName).toBeNull();
  });

  it("extracts psr-4 namespaces from autoload", () => {
    const records = buildComposerLockRecords(
      lock([pkg({ name: "acme/widget", autoload: { "psr-4": { "Acme\\Widget\\": "src/" } } })])
    );
    const fields = records.packageNodes.get("package:acme/widget")?.fields;

    expect(fields?.psr4Namespaces).toEqual(["Acme\\Widget\\"]);
  });

  it("creates a requires edge and a placeholder node for an undeclared dependency", () => {
    const records = buildComposerLockRecords(
      lock([pkg({ name: "acme/widget", require: { "acme/core": "^2.0", php: "~8.4.0" } })])
    );

    const placeholder = records.packageNodes.get("package:acme/core");
    expect(placeholder?.fields.composerNodeKind).toBe("placeholder");

    const edge = [...records.edges.values()].find(
      (candidate) =>
        candidate.edgeTable === "PACKAGE_REQUIRES_PACKAGE" &&
        candidate.fromNodeId === "package:acme/widget" &&
        candidate.toNodeId === "package:acme/core"
    );
    expect(edge).toBeDefined();
  });

  it("ignores platform requirements like php when building dependency edges", () => {
    const records = buildComposerLockRecords(
      lock([pkg({ name: "acme/widget", require: { php: "~8.4.0", "ext-json": "*" } })])
    );

    expect(records.packageNodes.has("package:php")).toBe(false);
    expect(records.packageNodes.has("package:ext-json")).toBe(false);
    expect([...records.edges.values()].some((edge) => edge.edgeTable === "PACKAGE_REQUIRES_PACKAGE")).toBe(false);
  });
});
