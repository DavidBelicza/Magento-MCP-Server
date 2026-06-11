<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

final class SymbolId
{
    private const PREFIXES = [
        'class' => 'php-class:',
        'interface' => 'php-interface:',
        'trait' => 'php-trait:',
        'enum' => 'php-enum:',
    ];

    public static function forSymbol(string $kind, string $fqcn): string
    {
        return (self::PREFIXES[$kind] ?? 'php-symbol:') . $fqcn;
    }

    public static function forMethod(string $ownerFqcn, string $name): string
    {
        return 'php-method:' . $ownerFqcn . '::' . $name;
    }
}
