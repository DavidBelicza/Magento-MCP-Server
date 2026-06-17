<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Tests\Parse;

use Magentic\PhpAnalyzer\Parse\DocBlockScope;
use Magentic\PhpAnalyzer\Parse\DocBlockTypeResolver;
use PHPStan\PhpDocParser\Lexer\Lexer;
use PHPStan\PhpDocParser\Parser\ConstExprParser;
use PHPStan\PhpDocParser\Parser\PhpDocParser;
use PHPStan\PhpDocParser\Parser\TypeParser;
use PHPStan\PhpDocParser\ParserConfig;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(DocBlockTypeResolver::class)]
final class DocBlockTypeResolverTest extends TestCase
{
    public function testEmptyDocBlockYieldsEmptyTypes(): void
    {
        $types = $this->resolver()->resolve('/** No tags here */', $this->scope());

        self::assertSame('', $types->returnType->scalar);
        self::assertSame([], $types->returnType->classes);
        self::assertSame([], $types->paramTypes);
    }

    public function testScalarReturn(): void
    {
        $types = $this->resolver()->resolve('/** @return int */', $this->scope());

        self::assertSame('int', $types->returnType->scalar);
        self::assertSame([], $types->returnType->classes);
    }

    public function testNullableScalarReturn(): void
    {
        $types = $this->resolver()->resolve('/** @return ?string */', $this->scope());

        self::assertSame('string|null', $types->returnType->scalar);
    }

    public function testParamClassResolvedAgainstNamespace(): void
    {
        $types = $this->resolver()->resolve('/** @param Helper $x */', $this->scope());

        self::assertArrayHasKey('x', $types->paramTypes);
        self::assertSame('App\\Service\\Helper', $types->paramTypes['x']->classes[0]->fqcn);
        self::assertFalse($types->paramTypes['x']->classes[0]->isArray);
    }

    public function testUseAliasResolution(): void
    {
        $scope = new DocBlockScope(
            'App\\Service',
            ['logger' => 'Psr\\Log\\LoggerInterface'],
            'App\\Service\\Thing',
            null
        );

        $types = $this->resolver()->resolve('/** @param Logger $log */', $scope);

        self::assertSame('Psr\\Log\\LoggerInterface', $types->paramTypes['log']->classes[0]->fqcn);
    }

    public function testLeadingBackslashIsAbsolute(): void
    {
        $types = $this->resolver()->resolve('/** @return \\Other\\Thing */', $this->scope());

        self::assertSame('Other\\Thing', $types->returnType->classes[0]->fqcn);
    }

    public function testArrayOfClassMarksIsArrayAndArrayScalar(): void
    {
        $types = $this->resolver()->resolve('/** @return Helper[] */', $this->scope());

        self::assertSame('array', $types->returnType->scalar);
        self::assertSame('App\\Service\\Helper', $types->returnType->classes[0]->fqcn);
        self::assertTrue($types->returnType->classes[0]->isArray);
    }

    public function testThisResolvesToSelfFqcn(): void
    {
        $types = $this->resolver()->resolve('/** @return $this */', $this->scope());

        self::assertSame('App\\Service\\Thing', $types->returnType->classes[0]->fqcn);
    }

    public function testMalformedDocBlockIsIgnored(): void
    {
        $types = $this->resolver()->resolve('not a doc comment', $this->scope());

        self::assertSame('', $types->returnType->scalar);
        self::assertSame([], $types->paramTypes);
    }

    private function resolver(): DocBlockTypeResolver
    {
        $config = new ParserConfig([]);
        $constExprParser = new ConstExprParser($config);
        $phpDocParser = new PhpDocParser($config, new TypeParser($config, $constExprParser), $constExprParser);

        return new DocBlockTypeResolver(new Lexer($config), $phpDocParser);
    }

    private function scope(): DocBlockScope
    {
        return new DocBlockScope('App\\Service', [], 'App\\Service\\Thing', 'App\\Service\\Base');
    }
}
