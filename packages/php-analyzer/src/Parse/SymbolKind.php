<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

enum SymbolKind: string
{
    case Class_ = 'class';
    case Interface_ = 'interface';
    case Trait_ = 'trait';
    case Enum_ = 'enum';
    case Method = 'method';

    public function idFor(string $identifier): string
    {
        return match ($this) {
            self::Class_ => 'php-class:' . $identifier,
            self::Interface_ => 'php-interface:' . $identifier,
            self::Trait_ => 'php-trait:' . $identifier,
            self::Enum_ => 'php-enum:' . $identifier,
            self::Method => 'php-method:' . $identifier,
        };
    }
}
