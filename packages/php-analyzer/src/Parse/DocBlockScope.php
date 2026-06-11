<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

readonly class DocBlockScope
{
    /**
     * @param array<string, string> $uses
     */
    public function __construct(
        public string $namespace,
        public array $uses,
        public string $selfFqcn,
        public ?string $parentFqcn
    ) {
    }
}
