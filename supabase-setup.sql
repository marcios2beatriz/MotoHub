-- Script de Configuração Limpa e Completa do Banco de Dados Supabase
-- ATENÇÃO: Este script apaga as tabelas antigas e as recria com todas as colunas corretas.

-- 1. Desativar chaves estrangeiras temporariamente para permitir o DROP limpo
drop table if exists public.rider_locations cascade;
drop table if exists public.deliveries cascade;
drop table if exists public.schedules cascade;
drop table if exists public.users cascade;
drop table if exists public.establishments cascade;
drop table if exists public.partner_requests cascade;

-- 2. Habilitar extensão de UUID se necessário
create extension if not exists "uuid-ossp";

-- 3. Tabela de Estabelecimentos
create table public.establishments (
  id text primary key,
  name text not null,
  email text,
  active boolean default true,
  phone text,
  address jsonb, -- Armazena o endereço estruturado
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  zip_code text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Tabela de Usuários
create table public.users (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null, -- 'admin', 'establishment', 'rider'
  active boolean default true,
  phone text,
  cpf text,
  password_hash text not null,
  must_reset_password boolean default false,
  establishment_id text references public.establishments(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. Tabela de Escalas (Schedules)
create table public.schedules (
  id text primary key,
  rider_id text references public.users(id) on delete cascade,
  establishment_id text references public.establishments(id) on delete cascade,
  date text not null, -- YYYY-MM-DD
  shift text not null, -- 'morning', 'afternoon', 'night'
  start_time text not null,
  end_time text not null,
  chat text,
  created_by text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. Tabela de Corridas (Deliveries)
create table public.deliveries (
  id text primary key,
  rider_id text references public.users(id) on delete cascade,
  establishment_id text references public.establishments(id) on delete cascade,
  date text not null,
  time text not null,
  value numeric not null,
  status text not null, -- 'pending', 'active', 'rejected', 'cancelled'
  schedule_id text references public.schedules(id) on delete set null,
  order_number text,
  notes text,
  customer_chat text,
  paid boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 7. Tabela de Solicitações de Parceria (Partner Requests)
create table public.partner_requests (
  id text primary key,
  establishment_name text not null,
  owner_name text not null,
  phone text not null,
  address text not null,
  status text not null default 'pending', -- 'pending', 'contacted'
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 8. Tabela de Localizações dos Motoboys (Rider Locations)
create table public.rider_locations (
  rider_id text primary key references public.users(id) on delete cascade,
  rider_name text not null,
  latitude numeric not null,
  longitude numeric not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Desativar RLS para simplificar o ambiente de teste e garantir sincronização imediata
alter table public.establishments disable row level security;
alter table public.users disable row level security;
alter table public.schedules disable row level security;
alter table public.deliveries disable row level security;
alter table public.partner_requests disable row level security;
alter table public.rider_locations disable row level security;