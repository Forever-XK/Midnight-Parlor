import { getGame } from './store';
import { recordGame } from './statsStore';

/** 单机、联机和 AI 调度共用：每局每名真人只结算一次。 */
export function recordFinishedGame(gameId: string): void {
  const game = getGame(gameId);
  if (!game || game.phase !== 'finished' || !game.result || game.statsRecorded) return;
  game.humans.forEach((human, seat) => {
    const role = game.roles[seat];
    if (human && role) {
      recordGame(game.playerNames[seat], role, role === game.result!.winner, game.result!.scores[seat]);
    }
  });
  game.statsRecorded = true;
}
