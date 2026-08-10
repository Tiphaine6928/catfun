<?php

namespace App\Tests\Factory;

use App\Entity\User;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Doctrine\ORM\EntityManagerInterface;

class UserFactory
{
    public static function createTestUser(
        EntityManagerInterface $em,
        UserPasswordHasherInterface $hasher,
        string $email = 'test@test.com',
        string $password = 'password'
    ): User {
        $user = new User();
        $user->setEmail($email);

        $hashed = $hasher->hashPassword($user, $password);
        $user->setPassword($hashed);

        $em->persist($user);
        $em->flush();

        return $user;
    }
}