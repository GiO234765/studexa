-- Studexa local database setup (run ONCE as the `postgres` superuser).
-- In pgAdmin: right-click your server -> Query Tool, paste this, and run.
-- In psql:   psql -U postgres -f db/setup-local.sql
--
-- This creates the login role and the two databases. It does NOT need to run
-- the pg_trgm extension here: that extension is "trusted" in PostgreSQL 13+,
-- so the V6 Flyway migration creates it automatically as the `studexa` owner.

CREATE ROLE studexa LOGIN PASSWORD 'change_me_locally';

CREATE DATABASE studexa      OWNER studexa ENCODING 'UTF8';
CREATE DATABASE studexa_test OWNER studexa ENCODING 'UTF8';
