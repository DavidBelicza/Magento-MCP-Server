<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

readonly class MethodDocTypes
{
    /**
     * @param array<string, DocType> $paramTypes
     */
    public function __construct(
        public DocType $returnType,
        public array $paramTypes
    ) {
    }

    public static function empty(): self
    {
        return new self(DocType::empty(), []);
    }
}
