<?php

declare(strict_types=1);

namespace Acme\Widget\Model;

abstract class AbstractWidget
{
    protected int $id = 0;

    public function getId(): int
    {
        return $this->id;
    }
}
