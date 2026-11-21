<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261121181801 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Parties jouées côté serveur (anti-triche) : état secret de chaque partie et score obtenu';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE game_session (id VARCHAR(32) NOT NULL, player_id INT NOT NULL, game_id INT NOT NULL, score_id INT DEFAULT NULL, level VARCHAR(20) DEFAULT NULL, state JSON NOT NULL, status VARCHAR(10) NOT NULL, created_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\', finished_at DATETIME DEFAULT NULL COMMENT \'(DC2Type:datetime_immutable)\', INDEX IDX_4586AAFB99E6F5DF (player_id), INDEX IDX_4586AAFBE48FD905 (game_id), UNIQUE INDEX UNIQ_4586AAFB12EB0A51 (score_id), INDEX IDX_GAME_SESSION_PLAYER_GAME (player_id, game_id, created_at), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE game_session ADD CONSTRAINT FK_4586AAFB99E6F5DF FOREIGN KEY (player_id) REFERENCES user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE game_session ADD CONSTRAINT FK_4586AAFBE48FD905 FOREIGN KEY (game_id) REFERENCES game (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE game_session ADD CONSTRAINT FK_4586AAFB12EB0A51 FOREIGN KEY (score_id) REFERENCES score (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE game_session DROP FOREIGN KEY FK_4586AAFB99E6F5DF');
        $this->addSql('ALTER TABLE game_session DROP FOREIGN KEY FK_4586AAFBE48FD905');
        $this->addSql('ALTER TABLE game_session DROP FOREIGN KEY FK_4586AAFB12EB0A51');
        $this->addSql('DROP TABLE game_session');
    }
}
