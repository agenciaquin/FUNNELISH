-- Resumen rodante por conversación (más contexto, menos tokens de IA).
alter table conversations add column if not exists resumen      text;
alter table conversations add column if not exists resumen_msgs int default 0;
