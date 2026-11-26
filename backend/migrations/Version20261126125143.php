<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261126125143 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Changement d\'email : demandes en attente de confirmation (empreinte du jeton envoyé à la nouvelle adresse)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE email_change_request (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, new_email VARCHAR(180) NOT NULL, token_hash VARCHAR(64) NOT NULL, expires_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\', created_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\', UNIQUE INDEX UNIQ_136F31FFB3BC57DA (token_hash), INDEX IDX_136F31FFA76ED395 (user_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE email_change_request ADD CONSTRAINT FK_136F31FFA76ED395 FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE email_change_request DROP FOREIGN KEY FK_136F31FFA76ED395');
        $this->addSql('DROP TABLE email_change_request');
    }
}
