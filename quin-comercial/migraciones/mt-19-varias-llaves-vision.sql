-- mt-19: varias llaves por proveedor (doble Groq) + soporte de visión por llave.
alter table ai_integraciones add column if not exists etiqueta       text;      -- "Groq #1", "Groq #2"…
alter table ai_integraciones add column if not exists soporta_vision boolean;   -- ¿esta llave lee imágenes?
alter table ai_integraciones add column if not exists modelo_vision  text;      -- modelo para imágenes (override)

-- Permitir VARIAS filas del mismo proveedor por empresa: quitar cualquier
-- restricción de unicidad (ej. UNIQUE(tenant_id, proveedor)) que lo impida.
-- No toca la PK (id), solo restricciones tipo UNIQUE.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'ai_integraciones'::regclass and contype = 'u'
  loop
    execute 'alter table ai_integraciones drop constraint ' || quote_ident(c.conname);
  end loop;
end $$;
