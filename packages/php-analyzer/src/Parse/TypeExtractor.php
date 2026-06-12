<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

use PhpParser\Node;

readonly class TypeExtractor
{
    public function __construct(
        private string $selfFqcn,
        private ?string $parentFqcn
    ) {
    }

    public function extract(?Node $type): ResolvedType
    {
        $classTypes = [];
        $scalarParts = [];
        $this->collect($type, $classTypes, $scalarParts);

        return new ResolvedType(array_values(array_unique($classTypes)), implode('|', $scalarParts));
    }

    /**
     * @param array<int, string> $classTypes
     * @param array<int, string> $scalarParts
     */
    private function collect(?Node $type, array &$classTypes, array &$scalarParts): void
    {
        match (true) {
            $type instanceof Node\NullableType => $this->collectNullable($type, $classTypes, $scalarParts),
            $type instanceof Node\UnionType,
            $type instanceof Node\IntersectionType => $this->collectComposite($type, $classTypes, $scalarParts),
            $type instanceof Node\Identifier => $this->addScalar($type->toString(), $classTypes, $scalarParts),
            $type instanceof Node\Name => $this->addClass($type->toString(), $classTypes),
            default => null,
        };
    }

    /**
     * @param array<int, string> $classTypes
     * @param array<int, string> $scalarParts
     */
    private function collectNullable(Node\NullableType $type, array &$classTypes, array &$scalarParts): void
    {
        $this->collect($type->type, $classTypes, $scalarParts);
        $scalarParts[] = 'null';
    }

    /**
     * @param array<int, string> $classTypes
     * @param array<int, string> $scalarParts
     */
    private function collectComposite(
        Node\UnionType|Node\IntersectionType $type,
        array &$classTypes,
        array &$scalarParts
    ): void {
        foreach ($type->types as $member) {
            $this->collect($member, $classTypes, $scalarParts);
        }
    }

    /**
     * @param array<int, string> $classTypes
     * @param array<int, string> $scalarParts
     */
    private function addScalar(string $name, array &$classTypes, array &$scalarParts): void
    {
        $lower = strtolower($name);

        if ($lower === 'self' || $lower === 'static' || $lower === 'parent') {
            $this->addClass($name, $classTypes);

            return;
        }

        $scalarParts[] = $lower;
    }

    /**
     * @param array<int, string> $classTypes
     */
    private function addClass(string $name, array &$classTypes): void
    {
        $classTypes[] = match (strtolower($name)) {
            'self', 'static' => $this->selfFqcn,
            'parent' => $this->parentFqcn ?? $name,
            default => $name,
        };
    }
}
