<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261121174418 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Niveaux de difficulté : liste des niveaux par jeu, niveau de chaque score (Mémoire : facile, normal, difficile)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE game ADD levels JSON DEFAULT NULL');
        $this->addSql('ALTER TABLE score ADD level VARCHAR(20) DEFAULT NULL');
        $this->addSql('CREATE INDEX IDX_SCORE_GAME_LEVEL_POINTS ON score (game_id, level, points)');

        // Le Mémoire a trois niveaux ; le Pendu n'en a pas (levels reste à NULL).
        // Les scores du Mémoire déjà enregistrés gardent un niveau NULL : on ne peut pas le deviner
        // (500 points peuvent venir du niveau Facile comme du Normal). Ils restent dans le classement
        // « tous niveaux ».
        $this->addSql(
            'UPDATE game SET levels = :levels WHERE name = :name',
            ['levels' => json_encode(['facile', 'normal', 'difficile']), 'name' => 'Mémoire'],
        );
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE game DROP levels');
        $this->addSql('DROP INDEX IDX_SCORE_GAME_LEVEL_POINTS ON score');
        $this->addSql('ALTER TABLE score DROP level');
    }
}
