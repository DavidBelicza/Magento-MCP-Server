import { describe, expect, it } from "vitest";
import { classifyConfigXml, isConfigXml } from "../../../../src/modules/processing/magento-xml/discovery";

describe("classifyConfigXml", () => {
  it("classifies an etc-level config file as the global area", () => {
    expect(classifyConfigXml("app/code/Vendor/Module/etc/di.xml")).toEqual({
      basename: "di.xml",
      area: "global"
    });
  });

  it("classifies an area subdirectory file by its directory", () => {
    expect(classifyConfigXml("Vendor/Module/etc/frontend/events.xml")).toEqual({
      basename: "events.xml",
      area: "frontend"
    });
    expect(classifyConfigXml("Vendor/Module/etc/webapi_rest/di.xml")).toEqual({
      basename: "di.xml",
      area: "webapi_rest"
    });
  });

  it("returns null for a non-config basename", () => {
    expect(classifyConfigXml("Vendor/Module/etc/config.xml")).toBeNull();
    expect(classifyConfigXml("Vendor/Module/view/frontend/layout/default.xml")).toBeNull();
  });

  it("returns null when the directory under etc is not a known area", () => {
    expect(classifyConfigXml("Vendor/Module/etc/unknownarea/di.xml")).toBeNull();
  });

  it("isConfigXml mirrors classifyConfigXml", () => {
    expect(isConfigXml("Vendor/Module/etc/crontab.xml")).toBe(true);
    expect(isConfigXml("Vendor/Module/etc/config.xml")).toBe(false);
  });
});
