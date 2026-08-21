-- Extensão necessária para gen_random_uuid() usado em todas as chaves primárias.
create extension if not exists pgcrypto;
