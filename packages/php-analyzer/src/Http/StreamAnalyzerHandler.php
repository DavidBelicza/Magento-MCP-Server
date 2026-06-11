<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Http;

use Magentic\PhpAnalyzer\Parse\DocBlockTypeResolver;
use Magentic\PhpAnalyzer\Parse\FileParser;
use Magentic\PhpAnalyzer\Parse\PathScanner;
use PhpParser\ParserFactory;
use PHPStan\PhpDocParser\Lexer\Lexer;
use PHPStan\PhpDocParser\Parser\ConstExprParser;
use PHPStan\PhpDocParser\Parser\PhpDocParser;
use PHPStan\PhpDocParser\Parser\TypeParser;
use PHPStan\PhpDocParser\ParserConfig;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Filesystem\Filesystem;

readonly class StreamAnalyzerHandler
{
    private LoggerInterface $logger;

    public function __construct(?LoggerInterface $logger = null)
    {
        $this->logger = $logger ?? new NullLogger();
    }

    public function handle(string $path): Response
    {
        try {
            $pathScanner = new PathScanner($this->validateAnalyzedSourcePath(), $this->createFileParser());

            $response = new StreamedResponse(function () use ($pathScanner, $path) {
                foreach ($pathScanner->scan([$path]) as $scanResponse) {
                    echo json_encode($scanResponse, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE) . "\n";
                    if (ob_get_level() > 0) {
                        ob_flush();
                    }
                    flush();
                }
            });
            
            $response->headers->set('Content-Type', 'application/x-ndjson');
            return $response;

        } catch (\RuntimeException $exception) {
            return new JsonResponse(['error' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
        }
    }

    private function validateAnalyzedSourcePath(): string
    {
        $analyzedSourcePath = getenv('MAGENTIC_ANALYZED_SOURCE_PATH') ?: '';
        $fs = new Filesystem();

        if ($analyzedSourcePath === '' || !$fs->exists($analyzedSourcePath)) {
            throw new \RuntimeException('MAGENTIC_ANALYZED_SOURCE_PATH is not set or does not exist.');
        }

        $realPath = realpath($analyzedSourcePath);

        if ($realPath === false) {
            throw new \RuntimeException('MAGENTIC_ANALYZED_SOURCE_PATH could not be resolved.');
        }

        return $realPath;
    }

    private function createFileParser(): FileParser
    {
        $parserConfig = new ParserConfig([]);
        $constExprParser = new ConstExprParser($parserConfig);
        $phpDocParser = new PhpDocParser($parserConfig, new TypeParser($parserConfig, $constExprParser), $constExprParser);
        $docBlockResolver = new DocBlockTypeResolver(new Lexer($parserConfig), $phpDocParser);

        return new FileParser((new ParserFactory())->createForNewestSupportedVersion(), $docBlockResolver);
    }
}
