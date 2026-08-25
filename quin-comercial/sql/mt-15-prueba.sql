-- Prueba gratis de 5 días para cuentas nuevas.
alter table tenants add column if not exists prueba_hasta timestamptz;
