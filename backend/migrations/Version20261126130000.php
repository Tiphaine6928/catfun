<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261126130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Durées de conservation : date de dernière connexion et date de l\'avertissement avant suppression d\'un compte inactif';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE user ADD last_login_at DATETIME DEFAULT NULL COMMENT \'(DC2Type:datetime_immutable)\', ADD inactivity_notice_sent_at DATETIME DEFAULT NULL COMMENT \'(DC2Type:datetime_immutable)\'');
        // Comptes existants : on part d'aujourd'hui (aucun n'est supprimé tout de suite)
        $this->addSql('UPDATE user SET last_login_at = NOW()');
        $this->addSql('ALTER TABLE user MODIFY last_login_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\'');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE user DROP last_login_at, DROP inactivity_notice_sent_at');
    }
}
