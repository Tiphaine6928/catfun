<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261112150241 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Score : ajout des points et des relations vers le joueur (user) et le jeu (game)';
    }

    public function up(Schema $schema): void
    {
        // Les anciennes lignes n'ont ni joueur, ni jeu, ni points : elles empêcheraient
        // l'ajout des clés étrangères NOT NULL, on les supprime.
        $this->addSql('DELETE FROM score');
        $this->addSql('ALTER TABLE score ADD player_id INT NOT NULL, ADD game_id INT NOT NULL, ADD points INT NOT NULL, CHANGE date date DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\'');
        $this->addSql('ALTER TABLE score ADD CONSTRAINT FK_3299375199E6F5DF FOREIGN KEY (player_id) REFERENCES user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE score ADD CONSTRAINT FK_32993751E48FD905 FOREIGN KEY (game_id) REFERENCES game (id) ON DELETE CASCADE');
        $this->addSql('CREATE INDEX IDX_3299375199E6F5DF ON score (player_id)');
        $this->addSql('CREATE INDEX IDX_32993751E48FD905 ON score (game_id)');
        $this->addSql('CREATE INDEX IDX_SCORE_GAME_POINTS ON score (game_id, points)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE score DROP FOREIGN KEY FK_3299375199E6F5DF');
        $this->addSql('ALTER TABLE score DROP FOREIGN KEY FK_32993751E48FD905');
        $this->addSql('DROP INDEX IDX_3299375199E6F5DF ON score');
        $this->addSql('DROP INDEX IDX_32993751E48FD905 ON score');
        $this->addSql('DROP INDEX IDX_SCORE_GAME_POINTS ON score');
        $this->addSql('ALTER TABLE score DROP player_id, DROP game_id, DROP points, CHANGE date date DATETIME NOT NULL');
    }
}
