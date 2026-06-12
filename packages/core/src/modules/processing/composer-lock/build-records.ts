import { createEdgeHash, createNodeHash } from "./create-record-hash.js";
import type { GraphFieldValue, GraphFields } from "../../graph/types.js";
import type {
  ComposerAuthor,
  ComposerDependencyMap,
  ComposerEdgeRecord,
  ComposerGraphRecords,
  ComposerLock,
  ComposerNodeRecord,
  ComposerPackage,
  ComposerRelationshipType
} from "./types.js";

export function buildComposerLockRecords(composerLock: ComposerLock): ComposerGraphRecords {
  const records: ComposerGraphRecords = {
    packageNodes: new Map(),
    authorNodes: new Map(),
    edges: new Map()
  };
  const packages = [...(composerLock.packages ?? []), ...(composerLock["packages-dev"] ?? [])];

  for (const composerPackage of packages) {
    records.packageNodes.set(createPackageId(composerPackage.name), createInstalledPackageNode(composerPackage));
  }

  for (const composerPackage of packages) {
    addAuthorRecords(records, composerPackage);
    addDependencyRecords(records, composerPackage, composerPackage.require ?? {}, "PACKAGE_REQUIRES_PACKAGE", "require");
    addDependencyRecords(
      records,
      composerPackage,
      composerPackage["require-dev"] ?? {},
      "PACKAGE_REQUIRES_DEV_PACKAGE",
      "require-dev"
    );
    addSuggestedPackageRecords(records, composerPackage);
    addDependencyRecords(records, composerPackage, composerPackage.replace ?? {}, "PACKAGE_REPLACES_PACKAGE");
    addDependencyRecords(records, composerPackage, composerPackage.provide ?? {}, "PACKAGE_PROVIDES_PACKAGE", undefined, {
      isVirtual: true
    });
    addDependencyRecords(records, composerPackage, composerPackage.conflict ?? {}, "PACKAGE_CONFLICTS_WITH_PACKAGE");
  }

  return records;
}

function createInstalledPackageNode(composerPackage: ComposerPackage): ComposerNodeRecord {
  const packageParts = splitPackageName(composerPackage.name);
  const license = composerPackage.license ?? [];
  const autoload = normalizeAutoload(composerPackage.autoload);
  const psr4Namespaces = getPsr4Namespaces(composerPackage.autoload);
  const phpRequirements = getPhpRequirements(composerPackage.require ?? {});
  const phpExtensions = getPhpExtensions(composerPackage.require ?? {});
  const hashFields = {
    id: createPackageId(composerPackage.name),
    name: composerPackage.name,
    vendor: packageParts.vendor,
    packageName: packageParts.packageName,
    composerNodeKind: "installed",
    version: composerPackage.version ?? null,
    type: composerPackage.type ?? null,
    description: composerPackage.description ?? null,
    sourceReference: composerPackage.source?.reference ?? null,
    distReference: composerPackage.dist?.reference ?? null,
    distShasum: composerPackage.dist?.shasum || null,
    license,
    isMagentoPackage: composerPackage.name.startsWith("magento/"),
    magentoModuleName: getMagentoModuleName(composerPackage),
    autoload,
    psr4Namespaces,
    phpRequirements,
    phpExtensions
  };
  const metadataHash = createNodeHash(hashFields);

  return {
    table: "Package",
    id: hashFields.id,
    metadataHash,
    fields: {
      ...hashFields,
      metadataHash
    }
  };
}

function addAuthorRecords(records: ComposerGraphRecords, composerPackage: ComposerPackage): void {
  for (const author of composerPackage.authors ?? []) {
    if (!author.name) {
      continue;
    }

    const authorId = createAuthorId(author);
    const hashFields = {
      id: authorId,
      name: author.name,
      email: author.email ?? null,
      homepage: author.homepage ?? null
    };
    const metadataHash = createNodeHash(hashFields);

    records.authorNodes.set(authorId, {
      table: "Author",
      id: authorId,
      metadataHash,
      fields: {
        ...hashFields,
        metadataHash
      }
    });

    addEdgeRecord(records, {
      edgeTable: "PACKAGE_AUTHORED_BY",
      fromNodeId: createPackageId(composerPackage.name),
      toNodeTable: "Author",
      toNodeId: authorId,
      fields: {
        role: author.role ?? null
      }
    });
  }
}

function addDependencyRecords(
  records: ComposerGraphRecords,
  composerPackage: ComposerPackage,
  dependencies: ComposerDependencyMap,
  edgeTable: ComposerRelationshipType,
  scope?: string,
  extraFields: GraphFields = {}
): void {
  for (const [dependencyName, versionConstraint] of Object.entries(dependencies)) {
    if (isPlatformRequirement(dependencyName)) {
      continue;
    }

    ensurePackagePlaceholder(records, dependencyName);
    addEdgeRecord(records, {
      edgeTable,
      fromNodeId: createPackageId(composerPackage.name),
      toNodeTable: "Package",
      toNodeId: createPackageId(dependencyName),
      fields: {
        versionConstraint,
        ...(scope ? { scope } : {}),
        ...extraFields
      }
    });
  }
}

function addSuggestedPackageRecords(records: ComposerGraphRecords, composerPackage: ComposerPackage): void {
  for (const [packageName, description] of Object.entries(composerPackage.suggest ?? {})) {
    if (isPlatformRequirement(packageName)) {
      continue;
    }

    ensurePackagePlaceholder(records, packageName);
    addEdgeRecord(records, {
      edgeTable: "PACKAGE_SUGGESTS_PACKAGE",
      fromNodeId: createPackageId(composerPackage.name),
      toNodeTable: "Package",
      toNodeId: createPackageId(packageName),
      fields: {
        description
      }
    });
  }
}

function ensurePackagePlaceholder(records: ComposerGraphRecords, packageName: string): void {
  const packageId = createPackageId(packageName);

  if (records.packageNodes.has(packageId)) {
    return;
  }

  const packageParts = splitPackageName(packageName);
  const hashFields = {
    id: packageId,
    name: packageName,
    vendor: packageParts.vendor,
    packageName: packageParts.packageName,
    composerNodeKind: "placeholder"
  };
  const metadataHash = createNodeHash(hashFields);

  records.packageNodes.set(packageId, {
    table: "Package",
    id: packageId,
    metadataHash,
    fields: {
      ...hashFields,
      metadataHash
    }
  });
}

function addEdgeRecord(
  records: ComposerGraphRecords,
  input: Omit<ComposerEdgeRecord, "fromNodeTable" | "edgeIdentity" | "metadataHash">
): void {
  const edgeIdentity = createEdgeIdentity(input.edgeTable, input.fromNodeId, input.toNodeId, input.fields);
  const hashFields = {
    edgeIdentity,
    edgeTable: input.edgeTable,
    fromNodeId: input.fromNodeId,
    toNodeId: input.toNodeId,
    fields: input.fields
  };
  const metadataHash = createEdgeHash(hashFields);

  records.edges.set(edgeIdentity, {
    ...input,
    fromNodeTable: "Package",
    edgeIdentity,
    metadataHash,
    fields: {
      ...input.fields,
      edgeIdentity,
      metadataHash
    }
  });
}

function createEdgeIdentity(edgeTable: string, fromNodeId: string, toNodeId: string, fields: GraphFields): string {
  const fieldIdentity = Object.keys(fields)
    .sort()
    .map((fieldName) => `${fieldName}:${String(fields[fieldName])}`)
    .join("|");

  return `edge:${edgeTable}:${fromNodeId}:${toNodeId}:${fieldIdentity}`;
}

function splitPackageName(packageName: string): { vendor: string | null; packageName: string } {
  const [vendor, name] = packageName.split("/");

  return {
    vendor: name ? vendor : null,
    packageName: name ?? packageName
  };
}

function createPackageId(packageName: string): string {
  return `package:${packageName}`;
}

function createAuthorId(author: ComposerAuthor): string {
  return `author:${author.name ?? ""}|${author.email ?? ""}|${author.homepage ?? ""}`;
}

function getMagentoModuleName(composerPackage: ComposerPackage): string | null {
  if (!composerPackage.name.startsWith("magento/module-")) {
    return null;
  }

  return composerPackage.name
    .replace("magento/module-", "")
    .split("-")
    .map((namePart) => `${namePart.charAt(0).toUpperCase()}${namePart.slice(1)}`)
    .join("");
}

function normalizeAutoload(autoload?: ComposerPackage["autoload"]): GraphFieldValue {
  return {
    psr4: normalizeNamespaceMap(autoload?.["psr-4"] ?? {}),
    psr0: normalizeNamespaceMap(autoload?.["psr-0"] ?? {}),
    classmap: autoload?.classmap ?? [],
    files: autoload?.files ?? []
  };
}

function getPsr4Namespaces(autoload?: ComposerPackage["autoload"]): string[] {
  return Object.keys(autoload?.["psr-4"] ?? {});
}

function normalizeNamespaceMap(namespaceMap: Record<string, string | string[]>): GraphFieldValue[] {
  return Object.entries(namespaceMap).map(([namespace, paths]) => ({
    namespace,
    paths: Array.isArray(paths) ? paths : [paths]
  }));
}

function getPhpRequirements(dependencies: ComposerDependencyMap): GraphFieldValue[] {
  return dependencies.php ? [{ name: "php", constraint: dependencies.php }] : [];
}

function getPhpExtensions(dependencies: ComposerDependencyMap): GraphFieldValue[] {
  return Object.entries(dependencies)
    .filter(([name]) => name.startsWith("ext-"))
    .map(([name, constraint]) => ({ name, constraint }));
}

function isPlatformRequirement(packageName: string): boolean {
  return packageName === "php" || packageName.startsWith("ext-") || packageName.startsWith("lib-");
}
