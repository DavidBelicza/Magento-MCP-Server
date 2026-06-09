<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Command;

use Magentic\PhpAnalyzer\Parse\FileParser;
use Magentic\PhpAnalyzer\Parse\SourceFile;
use Magentic\PhpAnalyzer\Parse\SourceFileFinder;
use PhpParser\ParserFactory;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\ConsoleOutputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(
    name: 'magentic:parse',
    description: 'Parse PHP source code for Magentic.'
)]
final class Parse extends Command
{
    protected function configure(): void
    {
        $this->addArgument(
            'paths',
            InputArgument::IS_ARRAY | InputArgument::REQUIRED,
            'One or more files or directories to scan for PHP files.'
        );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $errorOutput = $output instanceof ConsoleOutputInterface ? $output->getErrorOutput() : $output;
        $paths = $input->getArgument('paths');

        try {
            $fileParser = $this->createFileParser();
            $sourceFileFinder = new SourceFileFinder($this->validateAnalyzedSourcePath());

            foreach ($sourceFileFinder->findPhpFiles($paths) as $sourceFile) {
                $this->writeFactsForFile($sourceFile, $fileParser, $output);
            }
        } catch (\RuntimeException $exception) {
            $errorOutput->writeln(sprintf('<error>%s</error>', $exception->getMessage()));

            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }

    private function validateAnalyzedSourcePath(): string
    {
        $analyzedSourcePath = getenv('MAGENTIC_ANALYZED_SOURCE_PATH') ?: '';

        if ($analyzedSourcePath === '' || !is_dir($analyzedSourcePath)) {
            throw new \RuntimeException('MAGENTIC_ANALYZED_SOURCE_PATH is not set or is not a directory.');
        }

        $realPath = realpath($analyzedSourcePath);

        if ($realPath === false) {
            throw new \RuntimeException('MAGENTIC_ANALYZED_SOURCE_PATH could not be resolved.');
        }

        return $realPath;
    }

    private function createFileParser(): FileParser
    {
        return new FileParser((new ParserFactory())->createForNewestSupportedVersion());
    }

    private function writeFactsForFile(SourceFile $sourceFile, FileParser $fileParser, OutputInterface $output): void
    {
        foreach ($fileParser->parse($sourceFile->absolutePath, $sourceFile->relativePath) as $fact) {
            $output->writeln($this->encodeFact($fact));
        }
    }

    private function encodeFact(\JsonSerializable $fact): string
    {
        try {
            return json_encode($fact, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);
        } catch (\JsonException $exception) {
            throw new \RuntimeException($exception->getMessage(), 0, $exception);
        }
    }
}
