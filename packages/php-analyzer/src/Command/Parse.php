<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Command;

use PhpParser\ParserFactory;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(
    name: 'magentic:parse',
    description: 'Parse PHP source code for Magentic.'
)]
final class Parse extends Command
{
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $parser = (new ParserFactory())->createForNewestSupportedVersion();

        $output->writeln('magentic:parse ready');
        $output->writeln('Parser: ' . $parser::class);

        return Command::SUCCESS;
    }
}
