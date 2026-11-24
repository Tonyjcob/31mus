import { BOT_PERSONAS, NEUTRAL_PERSONA } from '@31mus/bots';
import { createSeededRng, type Seat } from '@31mus/engine';
import { describe, expect, it } from 'vitest';

import { Lobby, type SeatOccupant } from './lobby.js';

const rng = () => createSeededRng(7);

function kinds(lobby: Lobby): string[] {
  return lobby.occupants.map((occupant) => occupant.kind);
}

function personaOf(occupant: SeatOccupant): string | null {
  return occupant.kind === 'bot' ? occupant.persona.id : null;
}

describe('Lobby · solo', () => {
  it('un humano basta; los otros tres asientos pasan a bots distintos', () => {
    const lobby = new Lobby('solo');
    expect(lobby.isReady()).toBe(false);
    expect(lobby.takeSeat('u1', 'Ana', 0)).toBeNull();
    expect(lobby.isReady()).toBe(true);
    expect(lobby.start({}, rng())).toBeNull();
    expect(kinds(lobby)).toEqual(['human', 'bot', 'bot', 'bot']);
    const personas = lobby.occupants.map(personaOf).filter((id) => id !== null);
    expect(new Set(personas).size).toBe(3);
    expect(lobby.isStarted).toBe(true);
    expect(lobby.isReady()).toBe(false);
  });

  it('respeta el compañero y los rivales elegidos', () => {
    const lobby = new Lobby('solo');
    lobby.takeSeat('u1', 'Ana', 1);
    expect(lobby.start({ partner: 'abuelo', rivals: ['pollo', 'faraona'] }, rng())).toBeNull();
    expect(lobby.occupants.map(personaOf)).toEqual(['pollo', null, 'faraona', 'abuelo']);
  });

  it('sortea los que no se eligen sin repetir los elegidos', () => {
    for (let seed = 0; seed < 50; seed++) {
      const lobby = new Lobby('solo');
      lobby.takeSeat('u1', 'Ana', 0);
      lobby.start({ partner: 'rosario' }, createSeededRng(seed));
      const ids = lobby.occupants.map(personaOf).filter((id) => id !== null);
      expect(ids[1]).toBe('rosario');
      expect(new Set(ids).size).toBe(3);
    }
  });

  it('el neutro no sale por sorteo, pero se puede elegir (D22)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const lobby = new Lobby('solo');
      lobby.takeSeat('u1', 'Ana', 0);
      lobby.start({ partner: 'abuelo' }, createSeededRng(seed));
      expect(lobby.occupants.map(personaOf)).not.toContain(NEUTRAL_PERSONA.id);
    }
    const lobby = new Lobby('solo');
    lobby.takeSeat('u1', 'Ana', 0);
    expect(lobby.start({ rivals: ['neutro', 'pollo'] }, rng())).toBeNull();
    expect(personaOf(lobby.occupant(1))).toBe('neutro');
  });

  it('rechaza un personaje que no existe', () => {
    const lobby = new Lobby('solo');
    lobby.takeSeat('u1', 'Ana', 0);
    expect(lobby.start({ rivals: ['abuelo', 'fantasma'] }, rng())).toBe('UNKNOWN_PERSONA');
    expect(lobby.isStarted).toBe(false);
  });

  it('no admite un segundo humano, pero sí que el primero cambie de asiento', () => {
    const lobby = new Lobby('solo');
    lobby.takeSeat('u1', 'Ana', 0);
    expect(lobby.takeSeat('u2', 'Bea', 1)).toBe('SEAT_NOT_ALLOWED');
    expect(lobby.takeSeat('u1', 'Ana', 3)).toBeNull();
    expect(lobby.seatOf('u1')).toBe(3);
  });
});

describe('Lobby · duo_vs_bots', () => {
  it('los dos humanos van en la misma pareja; los rivales son bots', () => {
    const lobby = new Lobby('duo_vs_bots');
    expect(lobby.takeSeat('u1', 'Ana', 1)).toBeNull();
    expect(lobby.takeSeat('u2', 'Bea', 0)).toBe('SEAT_NOT_ALLOWED');
    expect(lobby.takeSeat('u2', 'Bea', 2)).toBe('SEAT_NOT_ALLOWED');
    expect(lobby.isReady()).toBe(false);
    expect(lobby.takeSeat('u2', 'Bea', 3)).toBeNull();
    expect(lobby.isReady()).toBe(true);
    expect(lobby.start({ rivals: ['abuelo', 'pollo'] }, rng())).toBeNull();
    expect(lobby.occupants.map(personaOf)).toEqual(['abuelo', null, 'pollo', null]);
  });

  it('el único sentado puede cambiarse a la otra pareja', () => {
    const lobby = new Lobby('duo_vs_bots');
    lobby.takeSeat('u1', 'Ana', 1);
    expect(lobby.takeSeat('u1', 'Ana', 0)).toBeNull();
    expect(lobby.takeSeat('u2', 'Bea', 2)).toBeNull();
  });
});

describe('Lobby · 2v2', () => {
  it('espera a cuatro humanos y no mete bots', () => {
    const lobby = new Lobby('2v2');
    (['a', 'b', 'c'] as const).forEach((id, seat) => lobby.takeSeat(id, id, seat as Seat));
    expect(lobby.isReady()).toBe(false);
    expect(lobby.start({}, rng())).toBe('NOT_IN_LOBBY');
    expect(lobby.takeSeat('d', 'd', 0)).toBe('SEAT_TAKEN');
    lobby.takeSeat('d', 'd', 3);
    expect(lobby.start({}, rng())).toBeNull();
    expect(kinds(lobby)).toEqual(['human', 'human', 'human', 'human']);
  });

  it('levantarse libera el asiento; sentarse en el propio no hace nada', () => {
    const lobby = new Lobby('2v2');
    lobby.takeSeat('a', 'A', 2);
    expect(lobby.takeSeat('a', 'A', 2)).toBeNull();
    expect(lobby.leaveSeat('a')).toBeNull();
    expect(lobby.leaveSeat('a')).toBeNull();
    expect(lobby.seatOf('a')).toBeNull();
    expect(lobby.humansSeated()).toBe(0);
  });
});

describe('Lobby · durante la partida', () => {
  function started(): Lobby {
    const lobby = new Lobby('duo_vs_bots');
    lobby.takeSeat('u1', 'Ana', 0);
    lobby.takeSeat('u2', 'Bea', 2);
    lobby.start({}, rng());
    return lobby;
  }

  it('no se puede sentar, levantar ni volver a empezar', () => {
    const lobby = started();
    expect(lobby.takeSeat('u3', 'Cris', 1)).toBe('NOT_IN_LOBBY');
    expect(lobby.leaveSeat('u1')).toBe('NOT_IN_LOBBY');
    expect(lobby.start({}, rng())).toBe('NOT_IN_LOBBY');
  });

  it('marca la desconexión y la vuelta sin perder el asiento (D7)', () => {
    const lobby = started();
    expect(lobby.connectedHumans()).toBe(2);
    lobby.setConnected('u1', false);
    expect(lobby.connectedHumans()).toBe(1);
    expect(lobby.seatOf('u1')).toBe(0);
    expect(lobby.occupant(0)).toMatchObject({ kind: 'human', connected: false });
    lobby.setConnected('u1', true);
    expect(lobby.connectedHumans()).toBe(2);
    lobby.setConnected('nadie', false);
    expect(lobby.connectedHumans()).toBe(2);
  });
});

it('el catálogo tiene personajes con nombre suficientes para tres bots', () => {
  expect(BOT_PERSONAS.filter((p) => p.id !== NEUTRAL_PERSONA.id).length).toBeGreaterThanOrEqual(3);
});
