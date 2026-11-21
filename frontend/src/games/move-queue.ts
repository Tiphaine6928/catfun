/**
 * File de coups : chaque coup est envoyé au serveur après la réponse au précédent,
 * dans l'ordre où le joueur les a joués, même s'il tape très vite.
 * Un coup qui échoue n'empêche pas les suivants.
 */
export type MoveQueue = <T>(move: () => Promise<T>) => Promise<T>;

export function createMoveQueue(): MoveQueue {
  let last: Promise<unknown> = Promise.resolve();

  return <T>(move: () => Promise<T>): Promise<T> => {
    const next = last.then(move, move);
    last = next.catch(() => undefined);

    return next;
  };
}
