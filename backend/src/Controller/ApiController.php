<?php

namespace App\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

class ApiController extends AbstractController
{
    #[Route('/api/register', methods: ['POST'])]
    public function register(
        Request $request,
        EntityManagerInterface $em,
        UserPasswordHasherInterface $passwordHasher
    ): JsonResponse {

        $data = json_decode($request->getContent(), true);

        if (!$data || !isset($data['email']) || !isset($data['password'])) {
            return new JsonResponse(['error' => 'Données invalides'], 400);
        }

        $user = new User();
        $user->setPseudo($data['pseudo']);
        $user->setEmail($data['email']);
        $hashedPassword = $passwordHasher->hashPassword($user, $data['password']);
        $user->setPassword($hashedPassword);

        $em->persist($user);
        $em->flush();

        return new JsonResponse(['message' => 'Utilisateur créé ✅'], 201);
    }

    #[Route('/api/login', methods: ['POST'])]
public function login(
    Request $request,
    EntityManagerInterface $em,
    UserPasswordHasherInterface $passwordHasher
): JsonResponse {

    $data = json_decode($request->getContent(), true);

    $user = $em->getRepository(User::class)->findOneBy([
        'email' => $data['email']
    ]);

    if (!$user || !$passwordHasher->isPasswordValid($user, $data['password'])) {
        return new JsonResponse(['error' => 'Identifiants invalides'], 401);
    }

    // ⚠️ version simple (pas JWT)
    return new JsonResponse([
        'message' => 'Connexion réussie ✅',
        'email' => $user->getEmail()
    ]);
}

#[Route('/api/me', methods: ['GET'])]
public function me(): JsonResponse
{
    $user = $this->getUser();

    if (!$user) {
        return new JsonResponse(['error' => 'Non connecté'], 401);
    }

    /** @var User $user */

    return new JsonResponse([
        'email' => $user->getEmail()
    ]);
}
}


