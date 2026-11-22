<?php

namespace App\Command;

use App\Repository\GameSessionRepository;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Supprime les vieilles parties de visiteurs : une fois le délai pour enregistrer le score passé,
 * elles ne servent plus. À lancer de temps en temps (ou chaque jour avec une tâche planifiée) :
 *   php bin/console app:guest-sessions:purge
 */
#[AsCommand(name: 'app:guest-sessions:purge', description: 'Supprime les parties de visiteurs de plus d\'un jour')]
class PurgeGuestSessionsCommand extends Command
{
    public function __construct(private readonly GameSessionRepository $sessionRepository)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('older-than', null, InputOption::VALUE_REQUIRED, 'Âge minimal des parties à supprimer', '1 day');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $age = (string) $input->getOption('older-than');
        try {
            $before = (new \DateTimeImmutable())->modify('-'.$age);
        } catch (\DateMalformedStringException) {
            $before = false;
        }
        if (false === $before || $before > new \DateTimeImmutable()) {
            $io->error(sprintf('Durée invalide : « %s » (exemple : "1 day", "12 hours").', $age));

            return Command::INVALID;
        }

        $deleted = $this->sessionRepository->deleteGuestSessionsBefore($before);
        $io->success(sprintf('%d partie(s) de visiteurs supprimée(s).', $deleted));

        return Command::SUCCESS;
    }
}
