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
    public function __construct(
        private Parser $parser,
        private DocBlockTypeResolver $docBlockResolver
    ) {
    }

    /**
     * @return array<int, Fact>
     */
    public function parse(string $absolutePath, string $relativePath): array
    {
        try {
            $source = $this->readSource($absolutePath);
            $nodes = $this->parser->parse($source) ?? [];
            $nodes = $this->resolveNames($nodes);
        } catch (Error $error) {
            return [Fact::error($relativePath, $error->getMessage())];
        } catch (\RuntimeException $exception) {
            return [Fact::error($relativePath, $exception->getMessage())];
        }

        $visitor = new SymbolVisitor($this->docBlockResolver);
        $traverser = new NodeTraverser();
        $traverser->addVisitor($visitor);
        $traverser->traverse($nodes);

        return $visitor->facts();
    }

    /**
     * @param array<int, Node> $nodes
     * @return array<int, Node>
     */
    private function resolveNames(array $nodes): array
    {
        $traverser = new NodeTraverser();
        $traverser->addVisitor(new NameResolver());

        return $traverser->traverse($nodes);
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
