import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from './App';
import { es } from './i18n/es';

afterEach(cleanup);

describe('App', () => {
  it('muestra el saludo de 31mus como encabezado principal', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(es.home.title);
  });
});
