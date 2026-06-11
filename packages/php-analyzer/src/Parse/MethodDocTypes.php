<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

readonly class MethodDocTypes
{
    /**
     * @param array<string, string> $paramTypes
     */
    public function __construct(
        public string $returnType,
        public array $paramTypes
    ) {
    }
}
