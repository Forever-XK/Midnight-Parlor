import { useEffect, useState } from 'react';
import type { GameState } from '@shared/types';
import ResultModal from './ResultModal';
import SpringEffect from './dph/SpringEffect';
import { conclusionSteps } from '@/lib/roundPresentation';
import VictoryEffect from './dph/VictoryEffect';

/** Mounted once per finished game; result audio starts only with the modal. */
export default function RoundConclusion({ state, blocked, onRevealSeat }: { state: GameState; blocked: boolean; onRevealSeat: (seat: number) => void }) {
  const [step, setStep] = useState(0);
  const sequence = conclusionSteps(state);
  const current = sequence[step];
  const duration = current.ms;
  const finished = current.kind === 'result';
  const revealingSeat = current.kind === 'hand' ? current.seat : null;
  useEffect(() => {
    if (!blocked && revealingSeat != null) onRevealSeat(revealingSeat);
  }, [blocked, revealingSeat, onRevealSeat]);
  useEffect(() => {
    if (blocked || finished) return;
    const timer = setTimeout(() => setStep(value => value + 1), duration);
    return () => clearTimeout(timer);
  }, [blocked, finished, step, duration]);

  if (blocked || step === 0) return null;
  if (finished) return <ResultModal state={state} />;
  if (current.kind === 'spring') return <SpringEffect reverse={current.reverse} />;
  if (current.kind === 'victory') return <div className="fixed inset-0 z-[55] pointer-events-none"><VictoryEffect winner={current.winner} /></div>;
  return null;
}
