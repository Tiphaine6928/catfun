<?php

namespace App\Controller;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Le backend ne sert que l'API (/api/…) : quelqu'un qui ouvre son adresse
 * dans un navigateur est renvoyé vers le site (le frontend).
 */
#[AsController]
final class RedirectToFrontendController
{
    public function __construct(
        #[Autowire(env: 'FRONTEND_URL')]
        private readonly string $frontendUrl,
    ) {
    }

    #[Route('/', name: 'app_home', methods: ['GET'])]
    public function __invoke(): RedirectResponse
    {
        return new RedirectResponse($this->frontendUrl);
    }
}
