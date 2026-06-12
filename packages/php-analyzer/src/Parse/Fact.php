<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

readonly class Fact implements \JsonSerializable
{
    /**
     * @param array<string, mixed> $values
     */
    private function __construct(private array $values)
    {
    }

    /**
     * @param array<string, mixed> $properties
     */
    public static function symbol(
        string $symbolId,
        string $fqcn,
        string $kind,
        bool $defined,
        array $properties = []
    ): self {
        $values = [
            'fact' => FactType::Symbol->value,
            'symbolId' => $symbolId,
            'fqcn' => $fqcn,
            'kind' => $kind,
            'defined' => $defined,
        ];

        if ($properties !== []) {
            $values['properties'] = $properties;
        }

        return new self($values);
    }

    /**
     * @param array<string, mixed> $fields
     */
    public static function reference(
        ReferenceKind $kind,
        string $fromSymbolId,
        string $toSymbolId,
        array $fields = [],
        ?string $identityKey = null
    ): self {
        $values = [
            'fact' => FactType::Reference->value,
            'kind' => $kind->value,
            'fromSymbolId' => $fromSymbolId,
            'toSymbolId' => $toSymbolId,
        ];

        if ($fields !== []) {
            $values['fields'] = $fields;
        }

        if ($identityKey !== null) {
            $values['identityKey'] = $identityKey;
        }

        return new self($values);
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
     * @return array<string, mixed>
     */
    public function jsonSerialize(): array
    {
        return $this->values;
    }
}
