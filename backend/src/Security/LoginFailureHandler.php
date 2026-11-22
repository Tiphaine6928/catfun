<?php

namespace App\Security;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\TooManyLoginAttemptsAuthenticationException;
use Symfony\Component\Security\Http\Authentication\AuthenticationFailureHandlerInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * Échec de connexion à l'API (POST /api/login).
 *
 * - Trop de tentatives : 429 Too Many Requests, avec un message en français et l'en-tête Retry-After.
 * - Autres échecs : réponse habituelle de LexikJWT (401 « Email ou mot de passe incorrect. »).
 */
final class LoginFailureHandler implements AuthenticationFailureHandlerInterface
{
    public function __construct(
        #[Autowire(service: 'lexik_jwt_authentication.handler.authentication_failure')]
        private readonly AuthenticationFailureHandlerInterface $lexikHandler,
        private readonly TranslatorInterface $translator,
    ) {
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): Response
    {
        if (!$exception instanceof TooManyLoginAttemptsAuthenticationException) {
            return $this->lexikHandler->onAuthenticationFailure($request, $exception);
        }

        $minutes = (int) ($exception->getMessageData()['%minutes%'] ?? 0);
        $headers = $minutes > 0 ? ['Retry-After' => (string) ($minutes * 60)] : [];

        return new JsonResponse([
            'code' => Response::HTTP_TOO_MANY_REQUESTS,
            'message' => $this->translator->trans($exception->getMessageKey(), $exception->getMessageData(), 'security'),
        ], Response::HTTP_TOO_MANY_REQUESTS, $headers);
    }
}
