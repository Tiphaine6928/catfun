<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261118100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajout des deux jeux de la plateforme : le Pendu et le jeu de Mémoire';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("INSERT INTO game (name, description) VALUES ('Pendu', 'Retrouve le mot caché lettre par lettre avant que le chat ne perde ses neuf vies.')");
        $this->addSql("INSERT INTO game (name, description) VALUES ('Mémoire', 'Retourne les cartes et retrouve les paires de chats le plus vite possible.')");
    }

    public function down(Schema $schema): void
    {
        $this->addSql("DELETE FROM game WHERE name IN ('Pendu', 'Mémoire')");
    }
}
