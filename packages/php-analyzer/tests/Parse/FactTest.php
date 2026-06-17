<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Tests\Parse;

use Magentic\PhpAnalyzer\Parse\Fact;
use Magentic\PhpAnalyzer\Parse\ReferenceKind;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(Fact::class)]
final class FactTest extends TestCase
{
    public function testSymbolFactWithoutProperties(): void
    {
        $fact = Fact::symbol('App\\Thing', 'App\\Thing', 'class', true);

        self::assertSame([
            'fact' => 'symbol',
            'symbolId' => 'App\\Thing',
            'fqcn' => 'App\\Thing',
            'kind' => 'class',
            'defined' => true,
        ], $fact->jsonSerialize());
    }

    public function testSymbolFactOmitsEmptyProperties(): void
    {
        $fact = Fact::symbol('App\\Thing', 'App\\Thing', 'class', true, []);

        self::assertArrayNotHasKey('properties', $fact->jsonSerialize());
    }

    public function testSymbolFactIncludesNonEmptyProperties(): void
    {
        $fact = Fact::symbol('App\\Thing', 'App\\Thing', 'class', false, ['abstract' => true]);

        self::assertSame(['abstract' => true], $fact->jsonSerialize()['properties']);
    }

    public function testReferenceFactWithFieldsAndIdentityKey(): void
    {
        $fact = Fact::reference(
            ReferenceKind::Extends,
            'App\\Child',
            'App\\Parent',
            ['line' => 10],
            'App\\Child=>App\\Parent'
        );

        self::assertSame([
            'fact' => 'reference',
            'kind' => ReferenceKind::Extends->value,
            'fromSymbolId' => 'App\\Child',
            'toSymbolId' => 'App\\Parent',
            'fields' => ['line' => 10],
            'identityKey' => 'App\\Child=>App\\Parent',
        ], $fact->jsonSerialize());
    }

    public function testReferenceFactOmitsOptionalKeysWhenAbsent(): void
    {
        $fact = Fact::reference(ReferenceKind::Extends, 'App\\Child', 'App\\Parent');
        $values = $fact->jsonSerialize();

        self::assertArrayNotHasKey('fields', $values);
        self::assertArrayNotHasKey('identityKey', $values);
    }

    public function testErrorFact(): void
    {
        $fact = Fact::error('src/Broken.php', 'syntax error');

        self::assertSame([
            'fact' => 'error',
            'path' => 'src/Broken.php',
            'message' => 'syntax error',
        ], $fact->jsonSerialize());
    }

    public function testIsJsonEncodable(): void
    {
        $fact = Fact::symbol('App\\Thing', 'App\\Thing', 'class', true);

        self::assertJson(json_encode($fact, JSON_THROW_ON_ERROR));
    }
}
