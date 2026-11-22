<?php

namespace App\Security;

use Symfony\Component\Validator\Constraint;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Règles d'un mot de passe, les mêmes à l'inscription et au changement de mot de passe.
 */
final class PasswordRules
{
    /**
     * @return list<Constraint>
     */
    public static function constraints(): array
    {
        return [
            new Assert\NotBlank(message: 'Merci de saisir un mot de passe.'),
            new Assert\Length(
                min: 6,
                max: 4096,
                minMessage: 'Le mot de passe doit faire au moins {{ limit }} caractères.',
            ),
        ];
    }
}
