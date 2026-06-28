import { describe, expect, it } from "vitest";
import { isStoreConfigXml } from "../../../../src/modules/processing/store-config/is-store-config-xml";

describe("isStoreConfigXml", () => {
  it("matches a module system.xml", () => {
    expect(isStoreConfigXml("vendor/magento/module-catalog/etc/adminhtml/system.xml")).toBe(true);
  });

  it("matches a system include fragment", () => {
    expect(isStoreConfigXml("app/code/Acme/Foo/etc/adminhtml/system/payment.xml")).toBe(true);
  });

  it("normalizes backslash separators", () => {
    expect(isStoreConfigXml("vendor\\acme\\foo\\etc\\adminhtml\\system.xml")).toBe(true);
  });

  it("rejects other Magento config XML (graph-owned)", () => {
    expect(isStoreConfigXml("app/code/Acme/Foo/etc/di.xml")).toBe(false);
    expect(isStoreConfigXml("app/code/Acme/Foo/etc/events.xml")).toBe(false);
    expect(isStoreConfigXml("app/code/Acme/Foo/etc/adminhtml/routes.xml")).toBe(false);
  });

  it("rejects a non-xml file under the system directory", () => {
    expect(isStoreConfigXml("app/code/Acme/Foo/etc/adminhtml/system/notes.txt")).toBe(false);
  });

  it("rejects php and other paths", () => {
    expect(isStoreConfigXml("app/code/Acme/Foo/Model/Config.php")).toBe(false);
    expect(isStoreConfigXml("composer.lock")).toBe(false);
  });
});
