# 🏀 Stat Trackers For Basket

Trackers de estadísticas en vivo para los equipos de básquetbol — Copa Talento.

## Estructura de carpetas

```
Stat Trackers For Basket/
├── Sub 18 Basket/     → Titans Sub-18 (con historial de temporada 2026)
└── Sub 16 Basket/     → Sub-16 (plantilla limpia, lista para configurar)
```

## Links

| Equipo | App | Importar historial |
|--------|-----|--------------------|
| **Sub 18 — Titans** | [Abrir](../index.html) | [Importar](../import-history.html) |
| **Sub 16** | [Abrir](Sub%2016%20Basket/index.html) | — |

> Los links de arriba son relativos al repo local. Para GitHub Pages usar las URLs completas.

## Cómo configurar Sub 16

1. Abrir `Sub 16 Basket/index.html`
2. Usar el botón **＋** para agregar los jugadores del equipo (reemplazar "Jugador 1", etc.)
3. O editar directamente `DEFAULT_PLAYERS` en `Sub 16 Basket/app.js`
4. El historial empieza vacío — cada partido nuevo se guarda automáticamente con **🔄 Nuevo**

## Cada tracker es independiente

- Datos guardados en `localStorage` por separado (keys distintas por equipo)
- Service workers con cache names distintos (`titans-sub18-v1` y `sub16-v1`)
- Se pueden instalar como PWA independientes en el mismo dispositivo
