<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

enum ReferenceKind: string
{
    case Extends = 'extends';
    case Implements = 'implements';
    case Uses = 'uses';
}
