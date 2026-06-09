<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

final class SourceFileFinder
{
    public function __construct(private string $analyzedSourcePath)
    {
    }

    /**
     * @param array<int, mixed> $paths
     * @return \Generator<SourceFile>
     */
    public function findPhpFiles(array $paths): \Generator
    {
        foreach ($paths as $path) {
            yield from $this->findPhpFilesForPath($path);
        }
    }

    /**
     * @return \Generator<SourceFile>
     */
    private function findPhpFilesForPath(mixed $path): \Generator
    {
        $relativePath = $this->validateInputPath($path);
        $realPath = $this->validateResolvedPath($relativePath, (string) $path);

        if (is_file($realPath)) {
            yield $this->validatePhpFile($realPath, $relativePath, (string) $path);

            return;
        }

        if (!is_dir($realPath)) {
            throw new \RuntimeException(sprintf('Path is not a file or directory: %s', (string) $path));
        }

        yield from $this->findPhpFilesInDirectory($realPath);
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

        if (!file_exists($resolvedPath)) {
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
     * @return \Generator<SourceFile>
     */
    private function findPhpFilesInDirectory(string $directory): \Generator
    {
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if ($file->isFile() && $this->isPhpFile($file->getPathname())) {
                yield new SourceFile(
                    $file->getPathname(),
                    $this->relativeAnalyzedSourcePath($file->getPathname())
                );
            }
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
