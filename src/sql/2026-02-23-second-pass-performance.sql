-- Segunda pasada de rendimiento (Supabase/PostgreSQL)

-- Acelera ORDER BY de listados de módulos
CREATE INDEX IF NOT EXISTS idx_modulos_numero_piso_nombre_id
  ON modulos (numero, piso, nombre, id);

-- Acelera listados de trámites por título cuando crezca el catálogo
CREATE INDEX IF NOT EXISTS idx_tramites_titulo_id
  ON tramites (titulo, id);

-- Cubrimos lectura frecuente de requisitos por trámite y orden visual
CREATE INDEX IF NOT EXISTS idx_requisitos_tramite_sort_id_cover
  ON requisitos (tramite_id, sort_order, id);
