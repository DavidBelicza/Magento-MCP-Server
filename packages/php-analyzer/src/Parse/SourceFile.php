<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

readonly class SourceFile
{
    public function __construct(
        public string $absolutePath,
        public string $relativePath
    ) {
    }
}
