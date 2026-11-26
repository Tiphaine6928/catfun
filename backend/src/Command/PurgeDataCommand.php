<?php

namespace App\Command;

use App\Entity\User;
use App\Repository\GameSessionRepository;
use App\Repository\ResetPasswordRequestRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

/**
 * Applique les durées de conservation des données (RGPD), annoncées sur la page Confidentialité.
 * Lancée chaque jour par le service « cron » de docker-compose.yml :
 *   php bin/console app:data:purge
 *
 * - parties de visiteurs : supprimées après 1 jour
 * - liens « mot de passe oublié » : supprimés une fois expirés (1 heure)
 * - parties abandonnées (jamais terminées) : supprimées après 30 jours
 * - comptes sans connexion depuis ACCOUNT_INACTIVITY_LIMIT (3 ans) : prévenus par email,
 *   puis supprimés ACCOUNT_DELETION_NOTICE plus tard (30 jours) s'ils ne se sont pas reconnectés
 */
#[AsCommand(name: 'app:data:purge', description: 'Supprime les données arrivées au bout de leur durée de conservation')]
class PurgeDataCommand extends Command
{
    public const GUEST_SESSIONS_KEPT = '1 day';
    public const ABANDONED_GAMES_KEPT = '30 days';

    public function __construct(
        private readonly GameSessionRepository $sessions,
        private readonly ResetPasswordRequestRepository $resetRequests,
        private readonly UserRepository $users,
        private readonly EntityManagerInterface $entityManager,
        private readonly MailerInterface $mailer,
        private readonly LoggerInterface $logger,
        #[Autowire(env: 'ACCOUNT_INACTIVITY_LIMIT')] private readonly string $inactivityLimit,
        #[Autowire(env: 'ACCOUNT_DELETION_NOTICE')] private readonly string $deletionNotice,
        #[Autowire(env: 'FRONTEND_URL')] private readonly string $frontendUrl,
        #[Autowire(env: 'MAILER_FROM')] private readonly string $mailerFrom,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $now = new \DateTimeImmutable();

        $guests = $this->sessions->deleteGuestSessionsBefore($now->modify('-'.self::GUEST_SESSIONS_KEPT));
        $links = $this->resetRequests->deleteExpired($now);
        $abandoned = $this->sessions->deleteAbandonedBefore($now->modify('-'.self::ABANDONED_GAMES_KEPT));

        // D'abord supprimer les comptes prévenus il y a assez longtemps, puis prévenir les nouveaux
        $deleted = $this->users->deleteNotifiedBefore($now->modify('-'.$this->deletionNotice));
        $notified = 0;
        $deletionDate = $now->modify('+'.$this->deletionNotice);
        foreach ($this->users->findInactiveNotYetNotified($now->modify('-'.$this->inactivityLimit)) as $user) {
            try {
                $this->mailer->send($this->noticeEmail($user, $deletionDate));
            } catch (TransportExceptionInterface $exception) {
                // Pas prévenu : on réessaiera demain, et le compte n'est pas supprimé
                $this->logger->error('Avertissement de suppression non envoyé : {error}', ['error' => $exception->getMessage()]);
                continue;
            }
            $user->markInactivityNoticeSent($now);
            ++$notified;
        }
        $this->entityManager->flush();

        $io->definitionList(
            ['Parties de visiteurs supprimées' => $guests],
            ['Liens « mot de passe oublié » expirés supprimés' => $links],
            ['Parties abandonnées supprimées' => $abandoned],
            ['Comptes inactifs prévenus' => $notified],
            ['Comptes inactifs supprimés' => $deleted],
        );
        $io->success('Durées de conservation appliquées.');

        return Command::SUCCESS;
    }

    private function noticeEmail(User $user, \DateTimeImmutable $deletionDate): Email
    {
        $pseudo = $user->getPseudo() ?? '';
        $date = (new \IntlDateFormatter('fr_FR', \IntlDateFormatter::LONG, \IntlDateFormatter::NONE))->format($deletionDate);
        $link = rtrim($this->frontendUrl, '/').'/#/login';

        return (new Email())
            ->from(Address::create($this->mailerFrom))
            ->to($user->getEmail() ?? '')
            ->subject('CatFun : ton compte va être supprimé')
            ->text(<<<TEXT
                Bonjour {$pseudo},

                Personne ne s'est connecté à ton compte CatFun depuis longtemps. Pour protéger tes données,
                il sera supprimé le {$date}, avec tes scores.

                Tu veux le garder ? Connecte-toi avant cette date, c'est tout :
                {$link}

                Sinon, tu n'as rien à faire.

                Twixy et Aïna 🐾
                TEXT)
            ->html(sprintf(
                '<p>Bonjour %s,</p><p>Personne ne s\'est connecté à ton compte CatFun depuis longtemps. Pour protéger tes données, il sera supprimé le <strong>%s</strong>, avec tes scores.</p>'
                .'<p>Tu veux le garder ? Connecte-toi avant cette date, c\'est tout :</p>'
                .'<p><a href="%s" style="display:inline-block;padding:10px 18px;background:#5e35b1;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold">Me connecter à CatFun</a></p>'
                .'<p>Sinon, tu n\'as rien à faire.</p><p>Twixy et Aïna 🐾</p>',
                htmlspecialchars($pseudo, \ENT_QUOTES),
                htmlspecialchars($date, \ENT_QUOTES),
                htmlspecialchars($link, \ENT_QUOTES),
            ));
    }
}
