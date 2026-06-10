<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Logging;

use Monolog\Logger;
use Monolog\Handler\StreamHandler;
use Monolog\Formatter\JsonFormatter;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

class LoggerFactory
{
    public static function create(): LoggerInterface
    {
        if (($_ENV['ENABLE_TELEMETRY'] ?? 'true') === 'true') {
            $logger = new Logger('magentic_analyzer_php');
            $handler = new StreamHandler('php://stderr', \Monolog\Level::Info);
            $handler->setFormatter(new JsonFormatter());
            $logger->pushHandler($handler);
            return $logger;
        }

        return new NullLogger();
    }
}
