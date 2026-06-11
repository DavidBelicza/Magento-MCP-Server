<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

use PhpParser\Node;

final readonly class TypeRenderer
{
    public function __construct(
        private string $selfFqcn,
        private ?string $parentFqcn
    ) {
    }

    public function render(?Node $type): string
    {
        if ($type === null) {
            return '';
        }

        if ($type instanceof Node\NullableType) {
            return $this->render($type->type) . '|null';
        }

        if ($type instanceof Node\UnionType) {
            return implode('|', array_map($this->renderPart(...), $type->types));
        }

        if ($type instanceof Node\IntersectionType) {
            return implode('&', array_map($this->renderPart(...), $type->types));
        }

        return $this->renderPart($type);
    }

    private function renderPart(Node $type): string
    {
        if ($type instanceof Node\IntersectionType) {
            return implode('&', array_map($this->renderPart(...), $type->types));
        }

        if ($type instanceof Node\Identifier || $type instanceof Node\Name) {
            return $this->renderName($type->toString());
        }

        return '';
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
