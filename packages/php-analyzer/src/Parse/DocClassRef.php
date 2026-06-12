<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

readonly class DocClassRef
{
    public function __construct(
        public string $fqcn,
        public bool $isArray
    ) {
    }
}
