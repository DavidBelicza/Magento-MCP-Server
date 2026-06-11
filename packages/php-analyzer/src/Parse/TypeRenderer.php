<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

use PhpParser\Node;

readonly class TypeRenderer
{
    public function __construct(
        private string $selfFqcn,
        private ?string $parentFqcn
    ) {
    }

    public function render(?Node $type): string
    {
        return match (true) {
            $type === null => '',
            $type instanceof Node\NullableType => $this->render($type->type) . '|null',
            $type instanceof Node\UnionType => implode('|', array_map($this->renderPart(...), $type->types)),
            $type instanceof Node\IntersectionType => implode('&', array_map($this->renderPart(...), $type->types)),
            default => $this->renderPart($type),
        };
    }

    private function renderPart(Node $type): string
    {
        return match (true) {
            $type instanceof Node\IntersectionType => implode('&', array_map($this->renderPart(...), $type->types)),
            $type instanceof Node\Identifier, $type instanceof Node\Name => $this->renderName($type->toString()),
            default => '',
        };
    }

    private function renderName(string $name): string
    {
        return match (strtolower($name)) {
            'self', 'static' => $this->selfFqcn,
            'parent' => $this->parentFqcn ?? $name,
            default => $name,
        };
    }
}
