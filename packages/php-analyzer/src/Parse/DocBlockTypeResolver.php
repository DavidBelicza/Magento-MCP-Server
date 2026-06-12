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
    private const FUNDAMENTALS = [
        'int' => true, 'integer' => true, 'float' => true, 'double' => true, 'string' => true,
        'bool' => true, 'boolean' => true, 'array' => true, 'iterable' => true, 'object' => true,
        'callable' => true, 'void' => true, 'never' => true, 'null' => true, 'false' => true,
        'true' => true, 'mixed' => true,
    ];

    private const ARRAY_GENERICS = [
        'array' => true, 'list' => true, 'iterable' => true, 'non-empty-array' => true,
        'non-empty-list' => true,
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
            return MethodDocTypes::empty();
        }

        $returns = $node->getReturnTagValues();
        $returnType = $returns === [] ? DocType::empty() : $this->collect($returns[0]->type, $scope);

        $paramTypes = [];
        foreach ($node->getParamTagValues() as $param) {
            $paramTypes[ltrim($param->parameterName, '$')] = $this->collect($param->type, $scope);
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

    private function collect(Type\TypeNode $type, DocBlockScope $scope): DocType
    {
        $classes = [];
        $scalars = [];
        $this->walk($type, $scope, false, $classes, $scalars);

        return new DocType($this->uniqueClasses($classes), implode('|', array_values(array_unique($scalars))));
    }

    /**
     * @param array<int, DocClassRef> $classes
     * @param array<int, string> $scalars
     */
    private function walk(
        Type\TypeNode $type,
        DocBlockScope $scope,
        bool $inArray,
        array &$classes,
        array &$scalars
    ): void {
        match (true) {
            $type instanceof Type\IdentifierTypeNode => $this->walkIdentifier($type->name, $scope, $inArray, $classes, $scalars),
            $type instanceof Type\ThisTypeNode => $this->addClass($scope->selfFqcn, $inArray, $classes),
            $type instanceof Type\NullableTypeNode => $this->walkNullable($type, $scope, $inArray, $classes, $scalars),
            $type instanceof Type\ArrayTypeNode => $this->walkArray($type, $scope, $classes, $scalars),
            $type instanceof Type\UnionTypeNode,
            $type instanceof Type\IntersectionTypeNode => $this->walkComposite($type, $scope, $inArray, $classes, $scalars),
            $type instanceof Type\GenericTypeNode => $this->walkGeneric($type, $scope, $classes, $scalars),
            default => null,
        };
    }

    /**
     * @param array<int, DocClassRef> $classes
     * @param array<int, string> $scalars
     */
    private function walkNullable(
        Type\NullableTypeNode $type,
        DocBlockScope $scope,
        bool $inArray,
        array &$classes,
        array &$scalars
    ): void {
        $this->walk($type->type, $scope, $inArray, $classes, $scalars);
        $scalars[] = 'null';
    }

    /**
     * @param array<int, DocClassRef> $classes
     * @param array<int, string> $scalars
     */
    private function walkArray(
        Type\ArrayTypeNode $type,
        DocBlockScope $scope,
        array &$classes,
        array &$scalars
    ): void {
        $scalars[] = 'array';
        $this->walk($type->type, $scope, true, $classes, $scalars);
    }

    /**
     * @param array<int, DocClassRef> $classes
     * @param array<int, string> $scalars
     */
    private function walkComposite(
        Type\UnionTypeNode|Type\IntersectionTypeNode $type,
        DocBlockScope $scope,
        bool $inArray,
        array &$classes,
        array &$scalars
    ): void {
        foreach ($type->types as $member) {
            $this->walk($member, $scope, $inArray, $classes, $scalars);
        }
    }

    /**
     * @param array<int, DocClassRef> $classes
     * @param array<int, string> $scalars
     */
    private function walkGeneric(
        Type\GenericTypeNode $type,
        DocBlockScope $scope,
        array &$classes,
        array &$scalars
    ): void {
        $base = strtolower(ltrim($type->type->name, '\\'));

        if (isset(self::ARRAY_GENERICS[$base])) {
            $scalars[] = 'array';
            foreach ($type->genericTypes as $member) {
                $this->walk($member, $scope, true, $classes, $scalars);
            }

            return;
        }

        $this->walk($type->type, $scope, false, $classes, $scalars);
        foreach ($type->genericTypes as $member) {
            $this->walk($member, $scope, false, $classes, $scalars);
        }
    }

    /**
     * @param array<int, DocClassRef> $classes
     * @param array<int, string> $scalars
     */
    private function walkIdentifier(
        string $name,
        DocBlockScope $scope,
        bool $inArray,
        array &$classes,
        array &$scalars
    ): void {
        $lower = strtolower(ltrim($name, '\\'));

        if ($lower === 'self' || $lower === 'static' || $lower === 'this') {
            $this->addClass($scope->selfFqcn, $inArray, $classes);

            return;
        }

        if ($lower === 'parent') {
            if ($scope->parentFqcn !== null) {
                $this->addClass($scope->parentFqcn, $inArray, $classes);
            }

            return;
        }

        if (isset(self::FUNDAMENTALS[$lower])) {
            $scalars[] = $lower;

            return;
        }

        $resolved = $this->resolveName($name, $scope);
        if ($resolved !== null) {
            $this->addClass($resolved, $inArray, $classes);
        }
    }

    private function resolveName(string $name, DocBlockScope $scope): ?string
    {
        if (str_contains($name, '-') || $name === '') {
            return null;
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

    /**
     * @param array<int, DocClassRef> $classes
     */
    private function addClass(
        string $fqcn,
        bool $isArray,
        array &$classes
    ): void {
        $classes[] = new DocClassRef($fqcn, $isArray);
    }

    /**
     * @param array<int, DocClassRef> $classes
     * @return array<int, DocClassRef>
     */
    private function uniqueClasses(array $classes): array
    {
        $seen = [];
        $unique = [];

        foreach ($classes as $class) {
            $key = $class->fqcn . ($class->isArray ? '[]' : '');
            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $unique[] = $class;
        }

        return $unique;
    }
}
