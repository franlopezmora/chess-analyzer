<div align="center">

# ♟️ Chess Analyzer

Analizador de partidas estilo chess.com que permite subir PGN, ejecutar evaluaciones con Stockfish y construir un perfil público para portfolio, CV y LinkedIn.

</div>

---

## 🚀 Visión general

- **Objetivo**: facilitar a jugadores y recruiters visualizar partidas históricas, análisis automatizados y métricas personales.
- **Despliegue**: optimizado para Vercel con funciones serverless y compatibilidad edge.
- **Documentación**: este README se mantiene vivo; servirá de base para publicaciones y repositorios públicos.

## 🧱 Stack propuesto

- **Frontend**: Next.js 14 (App Router) + TypeScript + TailwindCSS + componentes cliente para visor PGN (`react-chessground`, `@mliebelt/pgn-parser`).
- **Backend**: Route Handlers / Server Actions de Next con soporte serverless/background en Vercel.
- **Motor de análisis**: Stockfish (WASM) o microservicio externo para cargas pesadas.
- **Persistencia**: PostgreSQL (Neon) con Prisma ORM; Redis (Upstash) opcional para cola de jobs.
- **Autenticación**: NextAuth (Auth.js) con email/password y OAuth (Google).

## 🎯 Alcance del MVP

1. **Auth & onboarding**: registro/login, perfiles básicos, rutas protegidas.
2. **Gestión de partidas**: subida de PGN, parseo, guardado de metadatos y tags.
3. **Visor interactivo**: tablero, navegación move-by-move, anotaciones.
4. **Análisis automático**: job queue + Stockfish → métricas (accuracy, blunders, mejores jugadas).
5. **Dashboard personal**: lista filtrable, estados de análisis, estadísticas resumidas.
6. **Documentación lista para portfolio**: capturas, changelog, guía de despliegue.

## 🗺️ Roadmap breve

- [ ] Configurar Prisma + base Neon / Supabase.
- [ ] Integrar NextAuth y flujo de onboarding.
- [ ] Implementar subida y parsing de PGN.
- [ ] Construir visor y timeline de jugadas.
- [ ] Orquestar pipeline de análisis (Redis + función background).
- [ ] Diseñar dashboard/estadísticas y sección pública compartible.
- [ ] Preparar assets y copy para LinkedIn/portfolio.

## 📁 Estructura sugerida

```
src/
  app/             # App Router, rutas públicas y privadas
  components/      # UI reutilizable (tablero, timeline)
  lib/             # Configuración Prisma, clientes externos
  services/        # Lógica de análisis, colas, parsers
  styles/          # Configuración Tailwind/tema
prisma/
  schema.prisma
```

## 🧑‍💻 Desarrollo local

```bash
pnpm install
pnpm dev
# abrir http://localhost:3000
```

Variables recomendadas (archivo `.env.local`, no subirlo):

```
DATABASE_URL="postgres://..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
REDIS_URL="..."
SEED_USER_PASSWORD="Demo1234!"
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
ANALYSIS_QUEUE_KEY="chess:analyzer:analysis-jobs"
STOCKFISH_ENABLED="false"
STOCKFISH_DEPTH="12"
STOCKFISH_TIMEOUT_MS="4000"
```

## 🗄️ Prisma / base de datos

1. Configurá `DATABASE_URL` (Neon/Supabase) en `.env`.
2. Ejecutá `pnpm db:push` o `pnpm db:migrate` para aplicar el esquema.
3. Corre `pnpm prisma:generate` después de cada cambio en `schema.prisma`.
4. Usá `pnpm db:studio` para inspeccionar datos durante el desarrollo.
5. Generá datos demo con `pnpm db:seed` (usuario, partida, análisis y tags listos para capturas). El usuario inicial es `demo@chess-analyzer.dev` + `Demo1234!` (puedes sobrescribirlo vía `SEED_USER_PASSWORD`).

## 🔐 Autenticación (NextAuth)

- Dependencias instaladas: `next-auth`, `@auth/prisma-adapter`, `bcryptjs`.
- Proveedores habilitados:
  - **Credentials**: email + contraseña contra la columna `passwordHash`.
  - **Google / GitHub**: se agregan automáticamente cuando existan las variables de entorno correspondientes.
- Rutas relevantes:
  - `src/lib/auth.ts`: configuración central de NextAuth (providers, callbacks, adapter Prisma).
  - `src/app/api/auth/[...nextauth]/route.ts`: handler App Router.
  - `src/app/(auth)/login`: formulario con login demo y botones sociales.
- Middleware: `middleware.ts` protege `/dashboard` y cualquier ruta que agregues al matcher, redirigiendo a `/login` si no hay token.
- UI:
  - `SessionProvider` montado en `src/app/layout.tsx` via `Providers`.
  - La home detecta sesión y muestra CTA contextual.
- **Regla de theming**: cualquier nueva página debe leer/usar los tokens declarados en `globals.css` (ver sección de dark mode).

## 🌗 Tema claro/oscuro

- Toggle global (`ThemeToggle`) con persistencia en `localStorage`.
- Script inline en `layout.tsx` aplica el tema antes de hidratar para evitar flashes.
- Tokens (`--color-*`) y utilidades (`surface-card`, `text-muted`, etc.) ya cubren ambos temas.
- Siempre que agregues una nueva página o sección, usá esas utilidades/variables en lugar de colores hardcodeados.

## 📤 Carga y parsing de PGN

- Formulario en `/dashboard` (`UploadForm`) que permite pegar PGN y un título opcional.
- Server Action `uploadGameAction` (`src/app/dashboard/actions.ts`):
  - Valida los datos con `zod`.
  - Parsea el PGN con `@mliebelt/pgn-parser` y reconstruye la partida usando `chess.js` para obtener los FEN move-by-move.
  - Persiste la partida en `Game` + `Move` con estado de análisis `PENDING`.
  - `revalidatePath("/dashboard")` para refrescar la UI tras cada carga.
- Tras guardar, se encola un trabajo de análisis (o se ejecuta inline si no configuraste Upstash).
- Visor interactivo en `/dashboard` con `react-chessground`: controles play/pause, timeline, flip y progreso.
- Modo manual: una vez llegás al final del PGN (o desde el inicio si está vacío) podés seguir jugando arrastrando piezas legales; cada jugada manual se muestra en el timeline y podés resetear la rama manual con un click.

## ⚙️ Pipeline de análisis

- Cola con Upstash Redis (`src/lib/analysis-queue.ts`). Si las variables de Upstash no existen, el análisis corre inline para desarrollo.
- Worker (`src/jobs/analyze-game.ts`):
  - Consume un `gameId`, recorre las jugadas y solicita evaluaciones a Stockfish (opcional, activando `STOCKFISH_ENABLED=true`; de lo contrario, usa una heurística).
  - Guarda resultados en `Analysis` / `MoveAnalysis`, flaguea blunders/mistakes/inaccuracies y actualiza métricas en `Game`.
- Formas de dispararlo:
  - `POST /api/jobs/analyze` (ideal para cron en Vercel).
  - Script local `pnpm jobs:run`.
- Variables clave:
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ANALYSIS_QUEUE_KEY`.
  - `STOCKFISH_ENABLED`, `STOCKFISH_DEPTH`, `STOCKFISH_TIMEOUT_MS`, `STOCKFISH_ENGINE_NAME`.

## ☁️ Deployment en Vercel

1. Conectar el repo de GitHub a Vercel.
2. Configurar variables de entorno para cada ambiente (Preview/Production).
3. Activar `pnpm` como package manager (`corepack enable pnpm` localmente).
4. Opcional: usar funciones background para trabajos de análisis largos.

## 🏷️ Estrategia de versionado y releases

- **Flujo Git**: `main` (producción) + ramas feature. Cada merge a `main` despliega en Vercel.
- **Versionado semántico**: tags `vX.Y.Z`.
- **Pasos para release**:
  1. Actualizar changelog (sección “Releases” en este README).
  2. Ejecutar pruebas y verificación en Vercel Preview.
  3. `git tag vX.Y.Z && git push origin vX.Y.Z`.
  4. Crear GitHub Release con resumen, screenshots y links a demo.
  5. Compartir en LinkedIn/portfolio usando assets preparados.
- **Automatización opcional**: integrar `release-please` o `semantic-release` para generar notas automáticamente.

## 📣 Preparación para portfolio / LinkedIn

- Mantener carpeta `/public/media` con capturas/gifs.
- Documentar casos de uso destacados: importación masiva, análisis por apertura, insights personalizados.
- Añadir scripts para generar reportes PDF/markdown con resultados (ideal para adjuntar en CV).
- En la sección final de este archivo se recopilarán mensajes clave/listos para copiar.

## 📚 Documentación adicional

- `docs/arquitectura.md`: cómo se conectan frontend, backend, colas y observabilidad.
- `docs/release-playbook.md`: checklist y pasos para etiquetar versiones + difundirlas.
- `docs/portfolio-kit.md`: plantillas de copy, assets y métricas para LinkedIn/portfolio/CV.

## ✅ Buenas prácticas a seguir

- Commits estilo Conventional Commits (ej. `feat: agregar parser PGN`).
- Tests unitarios (Vitest) y E2E (Playwright) a medida que se añadan features críticas.
- Lint + format automáticos via `pnpm lint` y `pnpm check`.
- Mantener soporte light/dark en todas las nuevas vistas/components (usar tokens de `globals.css` o clases existentes).

---

¿Preguntas o sugerencias? Abrí un issue o escribe a través de LinkedIn una vez que el repositorio sea público. Este documento seguirá creciendo a la par del desarrollo.
