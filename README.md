# Totem

Sistema web para consulta pública de trámites y administración interna.

## Requisitos

- Node.js 20+
- Base de datos PostgreSQL (Supabase)

## Desarrollo local

1. Copia `.env.example` a `.env`.
2. Configura variables:
   - `DATABASE_URL`
   - `NODE_ENV`
   - `PORT` (opcional)
   - `SESSION_SECRET`
   - `ADMIN_PASSWORD`
3. Instala dependencias:

```bash
npm install
```

4. Inicia servidor:

```bash
npm run start
```

App en `http://localhost:3000`.

## Optimización SQL (Supabase)

Ejecuta estos scripts en el SQL Editor de Supabase:

- `src/sql/2026-02-19-performance-indexes.sql`
- `src/sql/2026-02-23-second-pass-performance.sql`

## Deploy en Render

Este repo incluye `render.yaml` para despliegue automático.

### Opción rápida (Blueprint)

1. Sube el proyecto a GitHub.
2. En Render: **New +** → **Blueprint**.
3. Selecciona tu repo.
4. Define variables faltantes:
   - `DATABASE_URL` (usa la URL pooled de Supabase)
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET` (si no quieres autogenerado)
5. Deploy.

### Opción manual (Web Service)

- Build command: `npm install`
- Start command: `npm run start`
- Health check path: `/`
- Variables: mismas del bloque anterior

En Render usa `NODE_ENV=production`.

## Subida a GitHub

```bash
git init
git add .
git commit -m "chore: prepare totem for render deployment"
git branch -M main
git remote add origin <TU_REPO_URL>
git push -u origin main
```

## Seguridad recomendada

- No usar `admin` en producción como contraseña.
- Mantener `.env` fuera del repo (ya está en `.gitignore`).
- Rotar `SESSION_SECRET` periódicamente.
- Ejecutar auditoría de producción antes de cada release: `npm audit --omit=dev`.
- Confirmar que no se suben secretos: `git status` y revisión de archivos antes de push.
