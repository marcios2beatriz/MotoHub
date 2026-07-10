-- Criar tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'rider', 'establishment')),
  active BOOLEAN NOT NULL DEFAULT true,
  password_hash TEXT NOT NULL,
  must_reset_password BOOLEAN DEFAULT false,
  establishment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de estabelecimentos
CREATE TABLE IF NOT EXISTS establishments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  phone TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de escalas
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  date DATE NOT NULL,
  shift TEXT NOT NULL CHECK (shift IN ('morning', 'afternoon', 'night')),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de entregas
CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL,
  establishment_id TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  value NUMERIC NOT NULL CHECK (value > 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')) DEFAULT 'active',
  schedule_id TEXT,
  order_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read BOOLEAN DEFAULT false
);

-- Criar tabela de solicitações de parceiros
CREATE TABLE IF NOT EXISTS partner_requests (
  id TEXT PRIMARY KEY,
  establishment_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'contacted')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de localizações de motoboys
CREATE TABLE IF NOT EXISTS rider_locations (
  rider_id TEXT PRIMARY KEY,
  rider_name TEXT NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir dados iniciais
INSERT INTO users (id, name, cpf, phone, email, role, active, password_hash, establishment_id) VALUES
  ('u1', 'Administrador Geral', '000.000.000-00', '(11) 99999-9999', 'admin@delivery.com', 'admin', true, 'admin123', NULL);

INSERT INTO users (id, name, cpf, phone, email, role, active, password_hash, establishment_id) VALUES
  ('u2', 'Carlos Silva (Motoqueiro)', '111.111.111-11', '(11) 98888-8888', 'carlos@delivery.com', 'rider', true, 'moto123', NULL);

INSERT INTO users (id, name, cpf, phone, email, role, active, password_hash, establishment_id) VALUES
  ('u3', 'Lucas Souza (Motoqueiro)', '222.222.222-22', '(11) 97777-7777', 'lucas@delivery.com', 'rider', true, 'moto123', NULL);

INSERT INTO users (id, name, cpf, phone, email, role, active, password_hash, establishment_id) VALUES
  ('u4', 'Gerente Bella Italia', '333.333.333-33', '(11) 3222-1111', 'bella@delivery.com', 'establishment', true, 'bella123', 'e1');

INSERT INTO establishments (id, name, street, number, neighborhood, city, state, zip_code, phone) VALUES
  ('e1', 'Pizzaria Bella Italia', 'Avenida Paulista', '1000', 'Bela Vista', 'São Paulo', 'SP', '01310-100', '(11) 3222-1111');

INSERT INTO establishments (id, name, street, number, neighborhood, city, state, zip_code, phone) VALUES
  ('e2', 'Burger House', 'Rua Augusta', '500', 'Consolação', 'São Paulo', 'SP', '01305-000', '(11) 3111-2222');
