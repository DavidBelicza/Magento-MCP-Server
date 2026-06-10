<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

readonly class Fact implements \JsonSerializable
{
    /**
     * @param array<string, string> $values
     */
    private function __construct(private array $values)
    {
    }

    public static function symbol(string $symbolId, string $fqcn, string $kind): self
    {
        return new self([
            'fact' => FactType::Symbol->value,
            'symbolId' => $symbolId,
            'fqcn' => $fqcn,
            'kind' => $kind,
        ]);
    }

    public static function reference(ReferenceKind $kind, string $fromSymbolId, string $toSymbolId): self
    {
        return new self([
            'fact' => FactType::Reference->value,
            'kind' => $kind->value,
            'fromSymbolId' => $fromSymbolId,
            'toSymbolId' => $toSymbolId,
        ]);
    }

    public static function error(string $path, string $message): self
    {
        return new self([
            'fact' => FactType::Error->value,
            'path' => $path,
            'message' => $message,
        ]);
    }

    /**
     * @return array<string, string>
     */
    public function jsonSerialize(): array
    {
        return $this->values;
    }
}
