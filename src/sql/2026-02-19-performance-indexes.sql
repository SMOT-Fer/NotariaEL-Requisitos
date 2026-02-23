CREATE INDEX IF NOT EXISTS idx_requisitos_tramite_sort_id
  ON requisitos (tramite_id, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_tramite_modulo_tramite_modulo
  ON tramite_modulo (tramite_id, modulo_id);

CREATE INDEX IF NOT EXISTS idx_tramite_modulo_modulo_tramite
  ON tramite_modulo (modulo_id, tramite_id);
