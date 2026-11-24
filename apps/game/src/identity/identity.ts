// Identidad de quien se une a una sala (ADR-0004 §3). La sala solo conoce este puerto: en H3 lo
// implementa la identidad de desarrollo y en H6, el ticket de juego de la API.

export interface Identity {
  readonly userId: string;
  readonly nickname: string;
  readonly kind: 'user' | 'guest';
}

export interface IdentityVerifier {
  /** `true` solo para verificadores que no se pueden usar en producción. */
  readonly devOnly: boolean;
  /** Devuelve la identidad o `null` si las opciones de unión no la acreditan. */
  verify(joinOptions: unknown): Promise<Identity | null>;
}
