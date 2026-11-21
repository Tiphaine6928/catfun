import { describe, expect, it } from 'vitest';
import { createMoveQueue } from './move-queue';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('createMoveQueue', () => {
  it('envoie les coups un par un, dans l’ordre, même si les premiers sont plus lents', async () => {
    const queue = createMoveQueue();
    const log: string[] = [];
    let running = 0;
    let maxRunning = 0;

    const move = (name: string, ms: number) =>
      queue(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await wait(ms);
        log.push(name);
        running--;
        return name;
      });

    const results = await Promise.all([move('A', 30), move('B', 1), move('C', 10)]);

    expect(log).toEqual(['A', 'B', 'C']);
    expect(results).toEqual(['A', 'B', 'C']);
    expect(maxRunning).toBe(1);
  });

  it('un coup qui échoue n’empêche pas les suivants', async () => {
    const queue = createMoveQueue();
    const failing = queue(async () => {
      throw new Error('réseau');
    });
    const next = queue(async () => 'ok');

    await expect(failing).rejects.toThrow('réseau');
    await expect(next).resolves.toBe('ok');
  });
});
