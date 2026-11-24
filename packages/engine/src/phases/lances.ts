/**
 * Secuencia de lances (REGLAS_MUS.md §4): grande → chica → pares → juego, o punto si nadie tiene
 * juego. En pares y juego se declara primero y solo hablan quienes tienen jugada.
 */
import { anyJuego, lancePlayers } from '../evaluators/lances.js';
import type { Lance } from '../evaluators/lances.js';
import { perSeat, seatsFrom, teamOf } from '../seat.js';
import type { PerSeat, Seat } from '../seat.js';
import type { LanceOutcome } from '../state.js';
import { emit, setPhase, updateHand } from '../step.js';
import type { Step } from '../step.js';
import { recount } from './scoring.js';

function nextLance(step: Step, lance: Lance): Lance | null {
  switch (lance) {
    case 'grande':
      return 'chica';
    case 'chica':
      return 'pares';
    case 'pares':
      return anyJuego(step.state.hand.hands) ? 'juego' : 'punto';
    case 'juego':
    case 'punto':
      return null;
  }
}

/** Abre un lance. Si no hay envite posible (pares o juego), lo cierra en el acto. */
export function startLance(step: Step, lance: Lance): Step {
  const { hand, mano } = step.state;

  if (lance !== 'pares' && lance !== 'juego') {
    const speakers = seatsFrom(mano);
    return emit(setPhase(step, { kind: 'lance', lance, speakers, turn: mano, bet: null }), {
      type: 'lanceStarted',
      lance,
      speakers,
      declarations: null,
    });
  }

  const players = lancePlayers(lance, hand.hands);
  const declared: PerSeat<boolean> = perSeat((seat) => players.includes(seat));
  const speakers = seatsFrom(mano).filter((seat) => declared[seat]);
  const declarations =
    lance === 'pares'
      ? { ...hand.declarations, pares: declared }
      : { ...hand.declarations, juego: declared };
  const started = emit(updateHand(step, { declarations }), {
    type: 'lanceStarted',
    lance,
    speakers,
    declarations: declared,
  });

  const [first] = speakers;
  if (first === undefined) return closeLance(started, lance, { kind: 'noJugado' });
  const teams = new Set(speakers.map(teamOf));
  if (teams.size === 1)
    return closeLance(started, lance, { kind: 'sinEnvite', team: teamOf(first) });
  return setPhase(started, { kind: 'lance', lance, speakers, turn: first, bet: null });
}

/** Cierra un lance y pasa al siguiente o, tras el último, al recuento. */
export function closeLance(step: Step, lance: Lance, outcome: LanceOutcome): Step {
  const closed = emit(
    updateHand(step, { lances: [...step.state.hand.lances, { lance, outcome }] }),
    { type: 'lanceClosed', lance, outcome },
  );
  const next = nextLance(closed, lance);
  return next === null ? recount(closed) : startLance(closed, next);
}

/** Rivales de `seat` que hablan en el lance, en orden de juego a partir de `seat`. */
export function respondersTo(seat: Seat, speakers: readonly Seat[]): readonly Seat[] {
  const team = teamOf(seat);
  return seatsFrom(seat).filter((s) => teamOf(s) !== team && speakers.includes(s));
}
