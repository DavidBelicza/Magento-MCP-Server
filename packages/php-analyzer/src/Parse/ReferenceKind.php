<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

enum ReferenceKind: string
{
    case Extends = 'extends';
    case Implements = 'implements';
    case Uses = 'uses';
    case HasMethod = 'has_method';
    case ParamType = 'param_type';
    case ReturnsType = 'returns_type';
}
