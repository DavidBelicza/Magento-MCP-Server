<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

readonly class PathScanner
{
    public function __construct(
        private string $analyzedSourcePath,
        private FileParser $fileParser
    ) {
    }

    /**
     * @param array<int, mixed> $paths
     * @return \Generator<array{file: string, facts: array<int, Fact>}>
     */
    public function scan(array $paths): \Generator
    {
        foreach ($paths as $path) {
            yield from $this->scanPath($path);
        }
    }

    /**
     * @return \Generator<array{file: string, facts: array<int, Fact>}>
     */
    private function scanPath(mixed $path): \Generator
    {
        $relativePath = $this->validateInputPath($path);
        $realPath = $this->validateResolvedPath($relativePath, (string) $path);

        $fs = new \Symfony\Component\Filesystem\Filesystem();

        if ((new \SplFileInfo($realPath))->isFile()) {
            $sourceFile = $this->validatePhpFile($realPath, $relativePath, (string) $path);
            yield from $this->parseAndYield($sourceFile);

            return;
        }

        if (!$fs->exists($realPath) || !(new \SplFileInfo($realPath))->isDir()) {
            throw new \RuntimeException(sprintf('Path is not a file or directory: %s', (string) $path));
        }

        yield from $this->scanDirectory($realPath);
    }

    /**
     * @return \Generator<array{file: string, facts: array<int, Fact>}>
     */
    private function parseAndYield(SourceFile $sourceFile): \Generator
    {
        $facts = $this->fileParser->parse($sourceFile->absolutePath, $sourceFile->relativePath);

        if (count($facts) > 0) {
            yield [
                'file' => $sourceFile->relativePath,
                'facts' => $facts,
            ];
        }
    }

    private function validateInputPath(mixed $path): string
    {
        if (!is_string($path) || $path === '') {
            throw new \RuntimeException(sprintf('Path does not exist: %s', (string) $path));
        }

        return $this->normalizeRelativePath($path);
    }

    private function validateResolvedPath(string $relativePath, string $originalPath): string
    {
        $resolvedPath = $this->resolveAnalyzedSourcePath($relativePath);
        $fs = new \Symfony\Component\Filesystem\Filesystem();

        if (!$fs->exists($resolvedPath)) {
            throw new \RuntimeException(sprintf('Path does not exist: %s', $originalPath));
        }

        $realPath = realpath($resolvedPath);

        if ($realPath === false || !$this->isWithinAnalyzedSourcePath($realPath)) {
            throw new \RuntimeException(sprintf('Path is outside the analyzed source: %s', $originalPath));
        }

        return $realPath;
    }

    private function validatePhpFile(string $absolutePath, string $relativePath, string $originalPath): SourceFile
    {
        if (!$this->isPhpFile($absolutePath)) {
            throw new \RuntimeException(sprintf('File is not a PHP file: %s', $originalPath));
        }

        return new SourceFile($absolutePath, $relativePath);
    }

    /**
     * @return \Generator<array{file: string, facts: array<int, Fact>}>
     */
    private function scanDirectory(string $directory): \Generator
    {
        $finder = new \Symfony\Component\Finder\Finder();
        $finder->files()->in($directory)->name('*.php');

        foreach ($finder as $file) {
            $sourceFile = new SourceFile(
                $file->getPathname(),
                $this->relativeAnalyzedSourcePath($file->getPathname())
            );
            yield from $this->parseAndYield($sourceFile);
        }
    }

    private function isPhpFile(string $path): bool
    {
        return strtolower(pathinfo($path, PATHINFO_EXTENSION)) === 'php';
    }

    private function resolveAnalyzedSourcePath(string $path): string
    {
        return rtrim($this->analyzedSourcePath, DIRECTORY_SEPARATOR)
            . DIRECTORY_SEPARATOR
            . ltrim($path, DIRECTORY_SEPARATOR);
    }

    private function normalizeRelativePath(string $path): string
    {
        return str_replace('\\', '/', ltrim($path, '/\\'));
    }

    private function relativeAnalyzedSourcePath(string $path): string
    {
        $relativePath = substr($path, strlen(rtrim($this->analyzedSourcePath, DIRECTORY_SEPARATOR)) + 1);

        return str_replace(DIRECTORY_SEPARATOR, '/', $relativePath);
    }

    private function isWithinAnalyzedSourcePath(string $path): bool
    {
        $sourcePath = rtrim($this->analyzedSourcePath, DIRECTORY_SEPARATOR);

        return $path === $sourcePath || str_starts_with($path, $sourcePath . DIRECTORY_SEPARATOR);
    }
}
