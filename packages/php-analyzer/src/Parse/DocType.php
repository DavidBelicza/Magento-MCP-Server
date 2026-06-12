<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

readonly class DocType
{
    /**
     * @param array<int, DocClassRef> $classes
     */
    public function __construct(
        public array $classes,
        public string $scalar
    ) {
    }

    public static function empty(): self
    {
        return new self([], '');
    }
}
