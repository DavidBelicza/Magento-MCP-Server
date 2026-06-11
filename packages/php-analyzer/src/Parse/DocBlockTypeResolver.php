<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

use PHPStan\PhpDocParser\Ast\PhpDoc\PhpDocNode;
use PHPStan\PhpDocParser\Ast\Type;
use PHPStan\PhpDocParser\Lexer\Lexer;
use PHPStan\PhpDocParser\Parser\PhpDocParser;
use PHPStan\PhpDocParser\Parser\TokenIterator;

readonly class DocBlockTypeResolver
{
    private const KEYWORDS = [
        'int' => true, 'integer' => true, 'float' => true, 'double' => true, 'string' => true,
        'bool' => true, 'boolean' => true, 'void' => true, 'never' => true, 'mixed' => true,
        'null' => true, 'false' => true, 'true' => true, 'array' => true, 'iterable' => true,
        'object' => true, 'callable' => true, 'resource' => true, 'scalar' => true, 'number' => true,
        'list' => true, 'array-key' => true, 'non-empty-array' => true, 'non-empty-list' => true,
        'non-empty-string' => true, 'class-string' => true, 'interface-string' => true,
        'trait-string' => true, 'enum-string' => true, 'callable-string' => true,
        'numeric' => true, 'numeric-string' => true, 'literal-string' => true,
        'positive-int' => true, 'negative-int' => true, 'key-of' => true, 'value-of' => true,
    ];

    public function __construct(
        private Lexer $lexer,
        private PhpDocParser $phpDocParser
    ) {
    }

    public function resolve(string $docComment, DocBlockScope $scope): MethodDocTypes
    {
        $node = $this->parse($docComment);
        if ($node === null) {
            return new MethodDocTypes('', []);
        }

        $returns = $node->getReturnTagValues();
        $returnType = $returns === [] ? '' : $this->render($returns[0]->type, $scope);

        $paramTypes = [];
        foreach ($node->getParamTagValues() as $param) {
            $paramTypes[ltrim($param->parameterName, '$')] = $this->render($param->type, $scope);
        }

        return new MethodDocTypes($returnType, $paramTypes);
    }

    private function parse(string $docComment): ?PhpDocNode
    {
        try {
            return $this->phpDocParser->parse(new TokenIterator($this->lexer->tokenize($docComment)));
        } catch (\Throwable) {
            return null;
        }
    }

    private function render(Type\TypeNode $type, DocBlockScope $scope): string
    {
        return match (true) {
            $type instanceof Type\IdentifierTypeNode => $this->renderIdentifier($type->name, $scope),
            $type instanceof Type\ThisTypeNode => $scope->selfFqcn,
            $type instanceof Type\NullableTypeNode => $this->render($type->type, $scope) . '|null',
            $type instanceof Type\ArrayTypeNode => $this->render($type->type, $scope) . '[]',
            $type instanceof Type\UnionTypeNode => $this->join('|', $type->types, $scope),
            $type instanceof Type\IntersectionTypeNode => $this->join('&', $type->types, $scope),
            $type instanceof Type\GenericTypeNode => $this->renderGeneric($type, $scope),
            default => '',
        };
    }

    /**
     * @param array<int, Type\TypeNode> $types
     */
    private function join(
        string $separator,
        array $types,
        DocBlockScope $scope
    ): string {
        return implode($separator, array_map(fn (Type\TypeNode $type): string => $this->render($type, $scope), $types));
    }

    private function renderGeneric(Type\GenericTypeNode $type, DocBlockScope $scope): string
    {
        return $this->render($type->type, $scope) . '<' . $this->join(',', $type->genericTypes, $scope) . '>';
    }

    private function renderIdentifier(string $name, DocBlockScope $scope): string
    {
        $lower = strtolower(ltrim($name, '\\'));

        if ($lower === 'self' || $lower === 'static' || $lower === 'this') {
            return $scope->selfFqcn;
        }

        if ($lower === 'parent') {
            return $scope->parentFqcn ?? $name;
        }

        if (isset(self::KEYWORDS[$lower])) {
            return $name;
        }

        if (str_starts_with($name, '\\')) {
            return ltrim($name, '\\');
        }

        $segments = explode('\\', $name);
        $firstLower = strtolower($segments[0]);

        if (isset($scope->uses[$firstLower])) {
            $rest = array_slice($segments, 1);

            return $rest === [] ? $scope->uses[$firstLower] : $scope->uses[$firstLower] . '\\' . implode('\\', $rest);
        }

        return $scope->namespace === '' ? $name : $scope->namespace . '\\' . $name;
    }
}
