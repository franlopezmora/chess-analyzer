# Arquitectura funcional

Este documento complementa el README y describe cómo se conectan las piezas del analizador de partidas para facilitar el desarrollo colaborativo y la comunicación en portfolio/CV.

## Visión de alto nivel

1. **Frontend (Next.js 14 App Router)**  
   - Páginas públicas para marketing/demo.  
   - Área autenticada con dashboard, visor PGN y sección de estadísticas.  
   - Componentes cliente only para tablero (`react-chessground`) y timeline.  
   - Server Components para listas y datos cacheables (React Cache / `revalidateTag`).

2. **Backend en el mismo repo**  
   - Route Handlers (`app/api/*/route.ts`) para CRUD de partidas, análisis y tags.  
   - Server Actions para operaciones rápidas ligadas a formularios.  
   - Funciones background de Vercel para jobs largos (análisis Stockfish).

3. **Persistencia y colas**  
   - PostgreSQL (Neon) con Prisma como ORM.  
   - Upstash Redis para cola de análisis y cachear evaluaciones parciales.  
   - Storage S3 compatible opcional para archivos PGN masivos.

4. **Motor de análisis**  
   - Stockfish WASM para evaluaciones inmediatas (profundidad baja).  
   - Servicio externo/worker para análisis profundos si el SLA lo requiere.  
   - Resultados guardados en tablas `Analysis` y `MoveAnalysis`.

5. **Observabilidad**  
   - Vercel Analytics + Log Drains hacia Axiom/Logflare.  
   - Alertas básicas (status page) y métricas de jobs en Redis.

## Módulos clave

| Módulo | Descripción | Entregables |
| --- | --- | --- |
| `app/(auth)` | Flujos de registro/login, enlaces mágicos, OAuth Google | UI + Server Actions validadas |
| `app/(dashboard)` | Listado de partidas, estados de análisis, filtros | Componentes server/client híbridos |
| `app/api/games` | CRUD de partidas y subida de PGN | Route Handlers con validaciones Zod |
| `services/analysis` | Orquestación de cola y ejecución Stockfish | Worker + helpers para métricas |
| `lib/prisma.ts` | Cliente Prisma con pooling Edge-friendly | Reutilizado en server/cron |
| `lib/auth.ts` | Config NextAuth | Adaptadores Prisma + providers |

## Flujos principales

### 1. Subida y análisis de partida
1. Usuario sube archivo PGN (drag & drop).  
2. Server Action valida y crea registro `Game` + movimientos.  
3. Se encola job en Redis (`analysis:gameId`).  
4. Función background consume la cola, corre Stockfish y guarda resultados.  
5. Webhook/`revalidateTag` refresca dashboard; usuario ve métricas.

### 2. Publicación de perfil/portfolio
1. Usuario marca partidas “destacadas” (tag `feature`).  
2. Página pública `app/u/[username]` lee datos cacheados y muestra highlights.  
3. Compartible en LinkedIn/portfolio usando OpenGraph cards.

## Consideraciones de escalabilidad

- **Separación de cargas**: mover análisis pesados a worker dedicado (Railway/Render) si la latencia en Vercel es un problema.  
- **Sharding de partidas**: limitar tamaño de PGN almacenado en DB y enviar archivo original a storage externo.  
- **Feature flags**: LaunchDarkly/GrowthBook para activar nuevas vistas sin interrumpir versión principal.  
- **Internacionalización**: App Router soporta `i18n` built-in; preparar diccionarios desde el MVP para publicar en inglés/español.

## Próximos pasos sugeridos

- Definir `schema.prisma` con todas las relaciones enumeradas en el backlog.  
- Configurar seeds que generen cuentas demo + partidas para las capturas del portfolio.  
- Documentar contratos (`types/api.ts`) para facilitar integración con apps móviles futuras.

