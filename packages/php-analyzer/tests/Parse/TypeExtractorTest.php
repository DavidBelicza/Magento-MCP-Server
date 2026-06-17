<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Tests\Parse;

use Magentic\PhpAnalyzer\Parse\TypeExtractor;
use PhpParser\Node;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(TypeExtractor::class)]
final class TypeExtractorTest extends TestCase
{
    public function testNullTypeYieldsEmptyResult(): void
    {
        $result = $this->extractor()->extract(null);

        self::assertSame([], $result->classTypes);
        self::assertSame('', $result->scalar);
    }

    public function testScalarIdentifier(): void
    {
        $result = $this->extractor()->extract(new Node\Identifier('int'));

        self::assertSame([], $result->classTypes);
        self::assertSame('int', $result->scalar);
    }

    public function testClassNameBecomesClassType(): void
    {
        $result = $this->extractor()->extract(new Node\Name('Foo\\Bar'));

        self::assertSame(['Foo\\Bar'], $result->classTypes);
        self::assertSame('', $result->scalar);
    }

    public function testNullableScalarAppendsNull(): void
    {
        $result = $this->extractor()->extract(new Node\NullableType(new Node\Identifier('string')));

        self::assertSame([], $result->classTypes);
        self::assertSame('string|null', $result->scalar);
    }

    public function testNullableClassKeepsClassAndNullScalar(): void
    {
        $result = $this->extractor()->extract(new Node\NullableType(new Node\Name('Foo\\Bar')));

        self::assertSame(['Foo\\Bar'], $result->classTypes);
        self::assertSame('null', $result->scalar);
    }

    public function testUnionOfScalars(): void
    {
        $result = $this->extractor()->extract(
            new Node\UnionType([new Node\Identifier('int'), new Node\Identifier('string')])
        );

        self::assertSame([], $result->classTypes);
        self::assertSame('int|string', $result->scalar);
    }

    public function testUnionMixesClassAndScalar(): void
    {
        $result = $this->extractor()->extract(
            new Node\UnionType([new Node\Name('Foo\\Bar'), new Node\Identifier('null')])
        );

        self::assertSame(['Foo\\Bar'], $result->classTypes);
        self::assertSame('null', $result->scalar);
    }

    public function testSelfResolvesToSelfFqcn(): void
    {
        $result = $this->extractor()->extract(new Node\Name('self'));

        self::assertSame(['App\\Service\\Thing'], $result->classTypes);
        self::assertSame('', $result->scalar);
    }

    public function testParentResolvesToParentFqcn(): void
    {
        $result = $this->extractor()->extract(new Node\Name('parent'));

        self::assertSame(['App\\Service\\Base'], $result->classTypes);
        self::assertSame('', $result->scalar);
    }

    public function testParentWithoutParentFqcnKeepsName(): void
    {
        $extractor = new TypeExtractor('App\\Service\\Thing', null);

        $result = $extractor->extract(new Node\Name('parent'));

        self::assertSame(['parent'], $result->classTypes);
    }

    public function testDuplicateClassTypesAreDeduped(): void
    {
        $result = $this->extractor()->extract(
            new Node\UnionType([new Node\Name('Foo\\Bar'), new Node\Name('Foo\\Bar')])
        );

        self::assertSame(['Foo\\Bar'], $result->classTypes);
    }

    private function extractor(): TypeExtractor
    {
        return new TypeExtractor('App\\Service\\Thing', 'App\\Service\\Base');
    }
}
