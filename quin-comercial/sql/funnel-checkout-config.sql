-- Config de los CAMPOS del checkout por embudo: renombrar/ocultar los campos
-- fijos del formulario y agregar campos personalizados (texto, teléfono, notas,
-- selector, etc.). Se guarda como JSON. Aditivo y retrocompatible: si está vacío,
-- el checkout se comporta exactamente igual que antes.
alter table funnels add column if not exists checkout_config jsonb;
