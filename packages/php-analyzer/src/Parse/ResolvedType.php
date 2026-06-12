<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

readonly class ResolvedType
{
    /**
     * @param array<int, string> $classTypes
     */
    public function __construct(
        public array $classTypes,
        public string $scalar
    ) {
    }
}
