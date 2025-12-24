# Playbook de releases y comunicación

Este documento describe el proceso recomendado para publicar versiones en GitHub, actualizar Vercel y difundir los hitos en LinkedIn/portfolio.

## 1. Checklist previa al release

- [ ] Todos los issues/tickets asociados están cerrados.  
- [ ] `pnpm lint`, `pnpm test` y `pnpm typecheck` sin errores.  
- [ ] Deploy de Preview en Vercel validado manualmente.  
- [ ] `README` y docs sincronizados con las nuevas features.  
- [ ] Capturas o gifs actualizados en `public/media`.  
- [ ] Notas de la versión redactadas (ver plantilla).

## 2. Versionado semántico

| Tipo | Impacto | Ejemplo |
| --- | --- | --- |
| `major` | Cambios incompatibles (ej. nueva API pública) | `v1.0.0` |
| `minor` | Features compatibles, mejoras visibles | `v0.2.0` |
| `patch` | Fixes o mejoras internas sin afectar UX | `v0.1.3` |

**Convención**: cada merge a `main` debe incluir bump en `package.json` (usando `changeset` o manual) antes de etiquetar.

## 3. Pasos técnicos

```bash
# 1. Asegurarse de estar en main y actualizado
git checkout main
git pull origin main

# 2. Actualizar versión
pnpm version <major|minor|patch>

# 3. Generar changelog (manual o via release-please)
pnpm changelog # opcional, reemplaza por herramienta elegida

# 4. Commit + tag
git add .
git commit -m "chore(release): v0.x.y"
git tag v0.x.y

# 5. Push
git push origin main --tags
```

## 4. Publicación en GitHub

1. Abrir la pestaña **Releases** → **Draft new release**.  
2. Seleccionar el tag recién creado.  
3. Completar la plantilla:

```markdown
## 🚀 Resumen
- Feature 1
- Mejora 2
- Fix 3

## 🧩 Detalles
- [Issue #123](link)
- [PR #456](link)

## 📸 Capturas
<img src="URL" width="400" />
```

4. Adjuntar assets (capturas/gifs) si aplica.  
5. Publicar release; GitHub notificará a watchers.

## 5. Comunicación externa

### LinkedIn

- Copiar highlights del resumen.  
- Adjuntar gif o imagen del dashboard.  
- CTA: enlace directo a demo en Vercel o a perfil público dentro de la app.  
- Usar hashtags `#nextjs`, `#vercel`, `#chess`, `#portfolio`.

### Portfolio web

- Actualizar sección “Proyectos” con:  
  - Versión actual (`v0.x.y`)  
  - 3 bullets de valor (ej. “Análisis automático con Stockfish”).  
  - Embed o link al perfil público generado por la app.

### CV/PDF

- Agregar línea en experiencia/proyectos con:  
  - Nombre del proyecto, stack principal, versión estable actual.  
  - Estadísticas (usuarios beta, partidas procesadas) si existen.  
  - QR o URL corta al deploy.

## 6. Post-release

- [ ] Crear issue “Release Retro” con aprendizajes.  
- [ ] Actualizar roadmap marcando features entregadas.  
- [ ] Revisar métricas de uso/errores en Vercel y abrir issues correctivos.  
- [ ] Preparar próximos objetivos para el siguiente tag.

