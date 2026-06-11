<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

use PhpParser\Error;
use PhpParser\Node;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitor\NameResolver;
use PhpParser\Parser;

readonly class FileParser
{
    public function __construct(private Parser $parser)
    {
    }

    /**
     * @return array<int, Fact>
     */
    public function parse(string $absolutePath, string $relativePath): array
    {
        try {
            $source = $this->readSource($absolutePath);
            $nodes = $this->parser->parse($source) ?? [];
            $traverser = new NodeTraverser();
            $traverser->addVisitor(new NameResolver());
            $nodes = $traverser->traverse($nodes);
        } catch (Error $error) {
            return [Fact::error($relativePath, $error->getMessage())];
        } catch (\RuntimeException $exception) {
            return [Fact::error($relativePath, $exception->getMessage())];
        }

        $facts = [];

        foreach ($this->extractTopLevelClasses($nodes) as [$class, $namespace]) {
            if (!$class->name instanceof Node\Identifier) {
                continue;
            }

            $fqcn = $this->createFqcn($class->name->toString(), $namespace);
            $classSymbolId = $this->createClassSymbolId($fqcn);

            $facts[] = $this->createClassSymbolFact($fqcn, true);

            if ($class->extends instanceof Node\Name) {
                $parentFqcn = $class->extends->toString();
                $facts[] = $this->createClassSymbolFact($parentFqcn, false);
                $facts[] = Fact::reference(ReferenceKind::Extends, $classSymbolId, $this->createClassSymbolId($parentFqcn));
            }

            foreach ($class->implements as $interface) {
                $interfaceFqcn = $interface->toString();
                $facts[] = $this->createInterfaceSymbolFact($interfaceFqcn, false);
                $facts[] = Fact::reference(ReferenceKind::Implements, $classSymbolId, $this->createInterfaceSymbolId($interfaceFqcn));
            }
        }

        foreach ($this->extractTopLevelInterfaces($nodes) as [$interface, $namespace]) {
            if (!$interface->name instanceof Node\Identifier) {
                continue;
            }

            $fqcn = $this->createFqcn($interface->name->toString(), $namespace);
            $interfaceSymbolId = $this->createInterfaceSymbolId($fqcn);

            $facts[] = $this->createInterfaceSymbolFact($fqcn, true);

            foreach ($interface->extends as $parent) {
                $parentFqcn = $parent->toString();
                $facts[] = $this->createInterfaceSymbolFact($parentFqcn, false);
                $facts[] = Fact::reference(ReferenceKind::Extends, $interfaceSymbolId, $this->createInterfaceSymbolId($parentFqcn));
            }
        }

        return $facts;
    }

    /**
     * @param array<int, Node> $nodes
     * @return \Generator<array{0: Node\Stmt\Class_, 1: string}>
     */
    private function extractTopLevelClasses(array $nodes): \Generator
    {
        foreach ($nodes as $node) {
            if ($node instanceof Node\Stmt\Class_) {
                yield [$node, ''];

                continue;
            }

            if (!$node instanceof Node\Stmt\Namespace_) {
                continue;
            }

            foreach ($node->stmts as $statement) {
                if ($statement instanceof Node\Stmt\Class_) {
                    yield [$statement, $node->name?->toString() ?? ''];
                }
            }
        }
    }

    /**
     * @param array<int, Node> $nodes
     * @return \Generator<array{0: Node\Stmt\Interface_, 1: string}>
     */
    private function extractTopLevelInterfaces(array $nodes): \Generator
    {
        foreach ($nodes as $node) {
            if ($node instanceof Node\Stmt\Interface_) {
                yield [$node, ''];

                continue;
            }

            if (!$node instanceof Node\Stmt\Namespace_) {
                continue;
            }

            foreach ($node->stmts as $statement) {
                if ($statement instanceof Node\Stmt\Interface_) {
                    yield [$statement, $node->name?->toString() ?? ''];
                }
            }
        }
    }

    private function createClassSymbolFact(string $fqcn, bool $defined): Fact
    {
        return Fact::symbol($this->createClassSymbolId($fqcn), $fqcn, 'class', $defined);
    }

    private function createInterfaceSymbolFact(string $fqcn, bool $defined): Fact
    {
        return Fact::symbol($this->createInterfaceSymbolId($fqcn), $fqcn, 'interface', $defined);
    }

    private function createClassSymbolId(string $fqcn): string
    {
        return 'php-class:' . $fqcn;
    }

    private function createInterfaceSymbolId(string $fqcn): string
    {
        return 'php-interface:' . $fqcn;
    }

    private function createFqcn(string $name, string $namespace): string
    {
        if ($namespace === '') {
            return $name;
        }

        return $namespace . '\\' . $name;
    }

    private function readSource(string $absolutePath): string
    {
        set_error_handler(static function (int $severity, string $message): never {
            throw new \RuntimeException($message, $severity);
        });

        try {
            $source = file_get_contents($absolutePath);
        } finally {
            restore_error_handler();
        }

        if ($source === false) {
            throw new \RuntimeException('Unable to read PHP file.');
        }

        return $source;
    }
}
