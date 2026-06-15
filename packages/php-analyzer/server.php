<?php

declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Magentic\PhpAnalyzer\Http\StreamAnalyzerHandler;
use Magentic\PhpAnalyzer\Logging\LoggerFactory;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

$request = Request::createFromGlobals();
$uri = $request->getPathInfo();
$method = $request->getMethod();

if ($uri === '/health' && $method === 'GET') {
    $response = new Response("OK\n", Response::HTTP_OK);
    $response->send();
    exit(0);
}

if ($uri === '/analyze' && $method === 'POST') {
    try {
        $isJsonRequest = $request->getContentTypeFormat() === 'json';
        $payload = $isJsonRequest ? $request->toArray() : json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
    } catch (\Exception) {
        $payload = [];
    }
    
    $path = $payload['path'] ?? '';
    $phpVersion = is_string($payload['phpVersion'] ?? null) ? $payload['phpVersion'] : null;

    $logger = LoggerFactory::create();
    $logger->info('Incoming PHP analysis request', ['path' => $path, 'phpVersion' => $phpVersion]);

    $handler = new StreamAnalyzerHandler($logger);
    $response = $handler->handle($path, $phpVersion);
    $response->send();
    exit(0);
}

$response = new Response("Not Found\n", Response::HTTP_NOT_FOUND);
$response->send();
exit(1);
