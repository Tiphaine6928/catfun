<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261118133142 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'User : ajout du pseudo unique (pseudo provisoire joueur_<id> pour les comptes existants)';
    }

    public function up(Schema $schema): void
    {
        // Colonne d'abord nullable : les comptes existants n'ont pas encore de pseudo.
        $this->addSql('ALTER TABLE user ADD pseudo VARCHAR(30) DEFAULT NULL');
        // Pseudo provisoire unique et valide (lettres, chiffres, "_") pour chaque compte existant.
        $this->addSql("UPDATE user SET pseudo = CONCAT('joueur_', id) WHERE pseudo IS NULL");
        $this->addSql('ALTER TABLE user MODIFY pseudo VARCHAR(30) NOT NULL');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_USER_PSEUDO ON user (pseudo)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX UNIQ_USER_PSEUDO ON user');
        $this->addSql('ALTER TABLE user DROP pseudo');
    }
}
