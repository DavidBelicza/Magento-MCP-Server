<?php

declare(strict_types=1);

namespace Acme\Widget\Api;

interface WidgetInterface
{
    public function getId(): int;

    public function getLabel(): string;
}
