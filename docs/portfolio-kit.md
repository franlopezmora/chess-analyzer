# Kit de contenido para portfolio / LinkedIn

Guía práctica para transformar el proyecto en material listo para compartir en LinkedIn, portafolio web y CV.

## 1. Narrativa del proyecto

- **Problema**: muchos jugadores acumulan PGN sin insights claros ni forma elegante de mostrarlos en procesos de selección.  
- **Solución**: plataforma que sube, analiza y resume partidas con métricas visuales y perfil compartible.  
- **Rol personal**: diseño completo de arquitectura, desarrollo fullstack, automatización de releases y storytelling.

## 2. Piezas recomendadas

| Medio | Recurso | Estado |
| --- | --- | --- |
| LinkedIn | Post + carrusel con highlights técnicos | ⚪ Pendiente |
| Portfolio web | Página dedicada con demo embebida | ⚪ Pendiente |
| CV | Sección “Proyectos destacados” | ⚪ Pendiente |
| GitHub | README + docs (este repo) | 🟢 En progreso |

## 3. Copys base

### LinkedIn (plantilla)

> **Nueva release: Chess Analyzer v0.x.y**  
> ✅ Subida de PGN con validación, visor interactivo y análisis Stockfish en serverless.  
> ⚙️ Stack: Next.js 14, Prisma, Neon, Upstash Redis, Vercel.  
> 💡 Pensado para adjuntar partidas en procesos de selección y compartir insights en segundos.  
> Demo: [link] — Repo: [link]  
> #nextjs #vercel #fullstack #chess

### Portfolio web

```
Chess Analyzer
Stack: Next.js 14, Prisma, Tailwind, Stockfish WASM, Vercel.
Valor: Permite subir partidas, ejecutar análisis automáticos y generar un perfil público con métricas para compartir en LinkedIn/CV.
Rol: Product design + arquitectura + implementación fullstack + estrategia de releases.
Link a demo | Link a repo
```

### CV

```
Chess Analyzer — Plataforma fullstack (Next.js + Vercel)
- Analizador de partidas PGN con visor interactivo y pipeline de Stockfish.
- Autenticación NextAuth, base Neon/PostgreSQL, cola Upstash Redis.
- Preparado para publicar versiones semánticas en GitHub y difundir en LinkedIn.
```

## 4. Capturas y assets

- Crear carpeta `public/media` con las siguientes piezas:  
  - `dashboard.png` (lista de partidas + estado análisis).  
  - `viewer.gif` (navegación move-by-move).  
  - `metrics.png` (tarjetas de accuracy, blunders, etc.).  
- Exportar variantes en 1200x627 (OpenGraph) y 1080x1080 (LinkedIn).  
- Mantener archivo `media/README.md` listando la fecha y la versión asociada a cada asset.

## 5. Métricas para mencionar

- Nº de partidas subidas durante pruebas (objetivo: 50+).  
- Tiempo promedio de análisis por partida.  
- % de reducción en tiempo de preparación de reportes frente a revisar PGN manual.  
- Feedback cualitativo de testers (breves citas).

## 6. Roadmap de storytelling

1. **MVP técnico listo** → Post “Behind the build”.  
2. **Primeros usuarios/testers** → Post con métricas y aprendizajes.  
3. **Release público v1.0** → Caso de estudio en portfolio.  
4. **Features avanzadas (import chess.com / mobile)** → Serie corta de artículos.

## 7. Próximas acciones

- [ ] Escribir primer post en LinkedIn cuando `v0.1.0` esté live.  
- [ ] Diseñar carrusel (Figma) contando el flujo “subir → analizar → compartir”.  
- [ ] Añadir sección “Prensa / posts” al README enlazando publicaciones externas.  
- [ ] Preparar video corto (30s) recorriendo la app para compartir en entrevistas.

