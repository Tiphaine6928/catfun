<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261122230000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Parties de visiteurs : une partie peut ne pas avoir de joueur';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE game_session CHANGE player_id player_id INT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DELETE FROM game_session WHERE player_id IS NULL');
        $this->addSql('ALTER TABLE game_session CHANGE player_id player_id INT NOT NULL');
    }
}
