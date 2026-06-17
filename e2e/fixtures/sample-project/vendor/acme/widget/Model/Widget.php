<?php

declare(strict_types=1);

namespace Acme\Widget\Model;

use Acme\Widget\Api\WidgetInterface;

class Widget extends AbstractWidget implements WidgetInterface
{
    public function __construct(
        private string $label
    ) {
    }

    public function getLabel(): string
    {
        return $this->label;
    }

    public function withParent(AbstractWidget $parent): WidgetInterface
    {
        $this->id = $parent->getId();

        return $this;
    }
}
