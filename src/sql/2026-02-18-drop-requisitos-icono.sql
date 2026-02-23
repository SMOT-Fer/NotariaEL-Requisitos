-- Elimina la columna icono de requisitos
-- Seguro de ejecutar varias veces
ALTER TABLE requisitos
DROP COLUMN IF EXISTS icono;