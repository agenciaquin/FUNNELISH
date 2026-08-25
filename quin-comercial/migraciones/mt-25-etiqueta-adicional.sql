-- mt-25: cada regla puede marcar, además de la etiqueta principal (estado), una
-- etiqueta ADICIONAL (una marca extra que se suma sin reemplazar el estado).
-- Ej: condición "envió el comprobante" → principal ABONO POR VERIFICAR + adicional "CLIENTE VIP".
alter table reglas_etiqueta add column if not exists etiqueta_adicional text;
