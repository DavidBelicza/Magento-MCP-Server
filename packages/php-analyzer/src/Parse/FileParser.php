<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

use PhpParser\Error;
use PhpParser\Node;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitor\NameResolver;
use PhpParser\Parser;

final class FileParser
{
    public function __construct(private Parser $parser)
    {
    }

    /**
     * @return \Generator<Fact>
     */
    public function parse(string $absolutePath, string $relativePath): \Generator
    {
        try {
            $source = $this->readSource($absolutePath);
            $nodes = $this->parser->parse($source) ?? [];
            $traverser = new NodeTraverser();
            $traverser->addVisitor(new NameResolver());
            $nodes = $traverser->traverse($nodes);
        } catch (Error $error) {
            yield Fact::error($relativePath, $error->getMessage());

            return;
        } catch (\RuntimeException $exception) {
            yield Fact::error($relativePath, $exception->getMessage());

            return;
        }

        foreach ($this->extractTopLevelClasses($nodes) as [$class, $namespace]) {
            if (!$class->name instanceof Node\Identifier) {
                continue;
            }

            $fqcn = $this->createClassFqcn($class->name->toString(), $namespace);

            yield $this->createSymbolFact($fqcn);

            if (!$class->extends instanceof Node\Name) {
                continue;
            }

            $parentFqcn = $class->extends->toString();

            yield $this->createSymbolFact($parentFqcn);
            yield Fact::reference(
                ReferenceKind::Extends,
                $this->createClassSymbolId($fqcn),
                $this->createClassSymbolId($parentFqcn)
            );
        }
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
     */
    private function createSymbolFact(string $fqcn): Fact
    {
        return Fact::symbol($this->createClassSymbolId($fqcn), $fqcn, 'class');
    }

    private function createClassSymbolId(string $fqcn): string
    {
        return 'php-class:' . $fqcn;
    }

    private function createClassFqcn(string $className, string $namespace): string
    {
        if ($namespace === '') {
            return $className;
        }

        return $namespace . '\\' . $className;
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
