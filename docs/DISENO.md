# Diseño de 31mus

**Fuente de verdad visual:** archivo de Figma de 31mus.
https://www.figma.com/design/4b09JnGSyK6aoi3c2ndgmz

**Espejo en Claude (Design System):** https://claude.ai/artifact/AroynnTikzmbuAkzYN1zE3
Mismos tokens con nombres en guion (`bg/app` → `bg-app`), normas de uso, componentes en HTML/CSS
(`components/bundle.css`) y las pantallas Inicio y Mesa como referencia. Útil para H4 si el MCP de Figma
no tiene llamadas disponibles.

## Estructura del archivo

| Página | Contenido |
|---|---|
| Fundamentos | (reservada) Paleta, tipografía y escalas documentadas |
| Componentes | Iconos, `Button`, `Card`, `CardBack`, `Tag`, `PlayerPlate` |
| Pantallas | `Mesa — Escritorio (1440)` y siguientes |

## Correcciones de contraste (prevalecen sobre Figma)

Figma todavía tiene los valores antiguos. Al implementar, usa estos:

| Variable | Figma | Valor correcto |
|---|---|---|
| `text/tertiary` | `#76817A` | **`#8D978F`** |
| `action/ordago` | `#E0484E` | **`#C4383E`** |
| Texto sobre el tapete | «En juego: 5 tantos» en `text/secondary` | **Siempre `text/primary`** |

## Variables

- **Color** (modo `Oscuro`): `bg/*`, `border/*`, `text/*`, `felt/*` (tapete), `action/*` (botones con volumen),
  `team/nosotros`, `team/ellos`, `status/up`, `status/down` (variación de ELO), `card/*`, `suit/*`.
- **Dimensión**: `space/4…32`, `radius/sm|md|lg|table|pill`.
- **Estilos de texto**: `Display/XL|L|M` (Bricolage Grotesque), `UI/*` (Figtree), `Card/Index`.
- **Efectos**: `Elevation/Panel`, `Elevation/Card`.

Al implementar (H4), volcar estas variables a `packages/design-tokens` con los mismos nombres
(`bg/app` → `--bg-app`) y usar `figma:figma-design-to-code`.

## Estado de las pantallas

| Pantalla | Estado |
|---|---|
| Mesa — Escritorio | Hecha, aprobada por Antonio |
| Inicio | Hecha (primera versión) |
| Jugar (pestaña Clasificatoria) | Hecha (primera versión) |
| Buscando partida | Hecha (primera versión) |
| Contra bots (selector de personajes) | Hecha. Pendiente: las barras vacías de estilo casi no se ven en la tarjeta seleccionada (usar `border/subtle`) |
| Resultado (+/− ELO) | Hecha, sin revisión visual (se alcanzó el límite del MCP) |
| Partidas en curso (lobby) | Pendiente |
| Sala de espera (4 asientos) | Pendiente |
| Clasificación de temporada | Pendiente |
| Perfil | Pendiente |
| Login / Registro | Pendiente |
| Tutorial | Pendiente |
| Mesa — Móvil | Pendiente |

## Especificación de las pantallas pendientes

Todas usan la misma estructura: navegación a la izquierda (200px), contenido con 32px de margen y,
cuando hay panel lateral, 380px a la derecha. Mismos componentes y variables.

- **Partidas en curso:** filtros (Todas, Clasificatoria, Casual) y una lista de filas `bg/raised` con:
  etiqueta de modo (oro si es clasificatoria), las dos parejas con su color, el marcador, los espectadores
  (`3 de 5`), un candado si es privada y el botón «Mirar» o «Sentarse». Panel derecho con «Crear sala»
  (modo y visibilidad) y «Unirse con código» (6 caracteres).
- **Sala de espera:** tapete con los 4 asientos. Los libres muestran «Sentarse» y los ocupados la placa
  del jugador. Panel derecho con el código de la sala para copiar, el modo, el chat y «Empezar» (activo
  cuando están todos).
- **Clasificación de temporada:** cabecera con el nombre de la temporada y los días que quedan. Tabla con
  puesto, jugador (avatar, nombre), ELO, partidas y % de victorias; tu fila resaltada y fijada al final si
  no estás en el top. Panel derecho con tu puesto, tu ELO y las insignias por posición (top 1, 10, 100).
- **Perfil:** cabecera con avatar grande, nombre, ELO actual y máximo. Gráfico de ELO de la temporada,
  tarjetas de estadísticas (partidas, % victorias, órdagos ganados, lances ganados), insignias e historial
  de partidas con su variación de ELO.
- **Login / Registro:** sin navegación. Tarjeta centrada sobre el tapete: logo, «Continuar con Google»,
  email y contraseña, «Crear cuenta» y «Jugar como invitado».
- **Tutorial:** la mesa con el resto de la pantalla atenuada y una tarjeta de guía junto al elemento que
  se explica («Paso 2 de 8: el mus»), con «Anterior», «Siguiente» y «Saltar tutorial».
- **Mesa — Móvil (390×844):** barra superior con el marcador compacto y el menú; tu pareja arriba y los
  rivales a los lados, con placas reducidas; tu mano y la barra de acciones abajo; el panel de partida y el
  chat en una hoja inferior que se abre con un botón.

## Límite del plan de Figma

El plan Starter limita las llamadas del MCP de Figma. Se agotó durante el diseño, y Claude Code lo
necesita en H4 para leer el diseño (`get_design_context`). Antes de H4, o se amplía el plan, o se exportan
las pantallas como PNG a `docs/diseno/` para que Claude Code trabaje con las imágenes y con este documento.
