-- Activar la extensión para UUID si fuera necesario en el futuro
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Eliminar tablas si existen (en orden inverso de relaciones de clave foránea)
DROP TABLE IF EXISTS liquidaciones;
DROP TABLE IF EXISTS gastos;
DROP TABLE IF EXISTS pagos;
DROP TABLE IF EXISTS creditos;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS rutas;
DROP TABLE IF EXISTS usuarios;

-- Usuarios: Controla el acceso de admins y cobradores
CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL, -- 'ADMIN' o 'COBRADOR'
    estado BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rutas: Agrupación geográfica
CREATE TABLE rutas (
    id_ruta SERIAL PRIMARY KEY,
    nombre_ruta VARCHAR(100) NOT NULL,
    id_cobrador INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clientes: Datos personales y de contacto
CREATE TABLE clientes (
    id_cliente SERIAL PRIMARY KEY,
    documento VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    id_ruta INT REFERENCES rutas(id_ruta) ON DELETE RESTRICT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créditos: Historial y préstamos activos
CREATE TABLE creditos (
    id_credito SERIAL PRIMARY KEY,
    id_cliente INT REFERENCES clientes(id_cliente) ON DELETE RESTRICT NOT NULL,
    id_credito_anterior INT REFERENCES creditos(id_credito) ON DELETE SET NULL NULL, -- Para trazabilidad de recogidas de saldo
    monto_prestado DECIMAL(10,2) NOT NULL,
    tasa_interes DECIMAL(5,2) NOT NULL,
    total_a_pagar DECIMAL(10,2) NOT NULL,
    saldo_pendiente DECIMAL(10,2) NOT NULL,
    valor_cuota DECIMAL(10,2) NOT NULL,
    frecuencia_pago VARCHAR(20) DEFAULT 'DIARIO',
    fecha_desembolso DATE NOT NULL,
    estado VARCHAR(20) DEFAULT 'ACTIVO', -- 'ACTIVO', 'PAGADO', 'MORA'
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pagos: Registro transaccional diario
CREATE TABLE pagos (
    id_pago SERIAL PRIMARY KEY,
    id_credito INT REFERENCES creditos(id_credito) ON DELETE CASCADE NOT NULL,
    id_cobrador INT REFERENCES usuarios(id_usuario) ON DELETE RESTRICT NOT NULL,
    monto_pagado DECIMAL(10,2) NOT NULL,
    tipo_pago VARCHAR(20) DEFAULT 'EFECTIVO', -- 'EFECTIVO' o 'RENOVACION' (no suma a caja física)
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    latitud DECIMAL(10,8),
    longitud DECIMAL(11,8),
    sincronizado_offline BOOLEAN DEFAULT TRUE
);

-- Gastos: Registro de gastos operativos de ruta
CREATE TABLE gastos (
    id_gasto SERIAL PRIMARY KEY,
    id_cobrador INT REFERENCES usuarios(id_usuario) ON DELETE RESTRICT NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    fecha DATE DEFAULT CURRENT_DATE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Liquidaciones: Cierre de jornada diario por cobrador
CREATE TABLE liquidaciones (
    id_liquidacion SERIAL PRIMARY KEY,
    id_cobrador INT REFERENCES usuarios(id_usuario) ON DELETE RESTRICT NOT NULL,
    fecha DATE DEFAULT CURRENT_DATE,
    total_recaudado DECIMAL(10,2) NOT NULL,
    total_gastos DECIMAL(10,2) NOT NULL,
    efectivo_entregado DECIMAL(10,2) NOT NULL,
    diferencia DECIMAL(10,2) NOT NULL,
    estado VARCHAR(20) DEFAULT 'PENDIENTE', -- 'PENDIENTE' o 'APROBADO'
    notas TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_cobrador_fecha UNIQUE (id_cobrador, fecha)
);

