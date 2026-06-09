<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

enum FactType: string
{
    case Symbol = 'symbol';
    case Reference = 'reference';
    case Error = 'error';
}
