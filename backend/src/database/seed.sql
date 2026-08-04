-- Insertar Usuarios (Contraseña por defecto para todos: 'admin123' / 'cobrador123' -> Hash Bcrypt)
INSERT INTO usuarios (nombre, email, password_hash, rol, estado) VALUES
('Administrador Principal', 'admin@zenu.com', '$2a$10$wPpP3BRpF/VWBsb3H8sgUum2RVzuj5Sguti/rkbJOBtc/hOXF6X0S', 'ADMIN', TRUE),
('Cobrador Zona Centro', 'cobrador@zenu.com', '$2a$10$zu3uFo4tx68TU9khDfgCJuQNkayFrhE6xkZ/L4AdyR40pZYnC82SS', 'COBRADOR', TRUE);

-- Insertar Rutas
INSERT INTO rutas (nombre_ruta, id_cobrador) VALUES
('Ruta Centro - Comercial', 2),
('Ruta Norte - Residencial', NULL);

-- Insertar Clientes
INSERT INTO clientes (documento, nombre, telefono, direccion, id_ruta) VALUES
('1045234567', 'Juan Carlos Pérez', '3001234567', 'Calle 72 #45-12, Sector Comercial', 1),
('1045890123', 'María Camila López', '3119876543', 'Carrera 15 #30-45, Barrio El Prado', 1),
('1045567890', 'Carlos Alberto Restrepo', '3205556677', 'Calle 50 #8-24, Norte', 2);

-- Insertar Créditos
-- Crédito 1: Activo y en progreso
INSERT INTO creditos (id_cliente, id_credito_anterior, monto_prestado, tasa_interes, total_a_pagar, saldo_pendiente, valor_cuota, frecuencia_pago, fecha_desembolso, estado) VALUES
(1, NULL, 1000000.00, 20.00, 1200000.00, 800000.00, 40000.00, 'DIARIO', CURRENT_DATE - INTERVAL '10 days', 'ACTIVO');

-- Crédito 2: Pagado
INSERT INTO creditos (id_cliente, id_credito_anterior, monto_prestado, tasa_interes, total_a_pagar, saldo_pendiente, valor_cuota, frecuencia_pago, fecha_desembolso, estado) VALUES
(2, NULL, 500000.00, 20.00, 600000.00, 0.00, 20000.00, 'DIARIO', CURRENT_DATE - INTERVAL '30 days', 'PAGADO');

-- Crédito 3: En mora
INSERT INTO creditos (id_cliente, id_credito_anterior, monto_prestado, tasa_interes, total_a_pagar, saldo_pendiente, valor_cuota, frecuencia_pago, fecha_desembolso, estado) VALUES
(3, NULL, 300000.00, 20.00, 360000.00, 360000.00, 15000.00, 'DIARIO', CURRENT_DATE - INTERVAL '15 days', 'MORA');

-- Insertar Pagos
-- Pagos para el Crédito 1 (Juan Carlos Pérez) - 10 cuotas programadas, ha pagado 10 abonos de 40000.00 = 400000.00 (Faltan 800000.00)
INSERT INTO pagos (id_credito, id_cobrador, monto_pagado, tipo_pago, fecha_hora, latitud, longitud, sincronizado_offline) VALUES
(1, 2, 40000.00, 'EFECTIVO', CURRENT_TIMESTAMP - INTERVAL '9 days', 10.411234, -75.289123, TRUE),
(1, 2, 40000.00, 'EFECTIVO', CURRENT_TIMESTAMP - INTERVAL '8 days', 10.411245, -75.289134, TRUE),
(1, 2, 40000.00, 'EFECTIVO', CURRENT_TIMESTAMP - INTERVAL '7 days', 10.411250, -75.289140, TRUE),
(1, 2, 40000.00, 'EFECTIVO', CURRENT_TIMESTAMP - INTERVAL '6 days', 10.411260, -75.289150, TRUE),
(1, 2, 40000.00, 'EFECTIVO', CURRENT_TIMESTAMP - INTERVAL '5 days', 10.411270, -75.289160, TRUE),
(1, 2, 40000.00, 'EFECTIVO', CURRENT_TIMESTAMP - INTERVAL '4 days', 10.411280, -75.289170, TRUE),
(1, 2, 40000.00, 'EFECTIVO', CURRENT_TIMESTAMP - INTERVAL '3 days', 10.411290, -75.289180, TRUE),
(1, 2, 40000.00, 'EFECTIVO', CURRENT_TIMESTAMP - INTERVAL '2 days', 10.411300, -75.289190, TRUE),
(1, 2, 40000.00, 'EFECTIVO', CURRENT_TIMESTAMP - INTERVAL '1 days', 10.411310, -75.289200, TRUE),
(1, 2, 40000.00, 'EFECTIVO', CURRENT_TIMESTAMP, 10.411320, -75.289210, TRUE);

-- Pagos para el Crédito 2 (María Camila López) - Ha pagado la totalidad (600000.00) en 30 cuotas de 20000.00
INSERT INTO pagos (id_credito, id_cobrador, monto_pagado, tipo_pago, fecha_hora, latitud, longitud, sincronizado_offline) VALUES
(2, 2, 300000.00, 'EFECTIVO', CURRENT_TIMESTAMP - INTERVAL '20 days', 10.412100, -75.290100, TRUE),
(2, 2, 300000.00, 'EFECTIVO', CURRENT_TIMESTAMP - INTERVAL '10 days', 10.412200, -75.290200, TRUE);

-- Insertar Gastos operativos de prueba
INSERT INTO gastos (id_cobrador, descripcion, monto, fecha) VALUES
(2, 'Combustible para moto de ruta', 15000.00, CURRENT_DATE - INTERVAL '1 day'),
(2, 'Almuerzo en ruta', 12000.00, CURRENT_DATE - INTERVAL '1 day'),
(2, 'Combustible ruta mañana', 10000.00, CURRENT_DATE);

-- Insertar Liquidaciones de prueba (Cierre de ayer)
-- Ayer se recaudaron abonos de crédito (simulado: 40000 de abono del crédito 1)
-- Ayer hubo gastos de 15000 + 12000 = 27000
-- Efectivo esperado = 40000 - 27000 = 13000
-- Efectivo entregado = 13000 (Diferencia = 0, estado APROBADO)
INSERT INTO liquidaciones (id_cobrador, fecha, total_recaudado, total_gastos, efectivo_entregado, diferencia, estado, notas) VALUES
(2, CURRENT_DATE - INTERVAL '1 day', 40000.00, 27000.00, 13000.00, 0.00, 'APROBADO', 'Liquidación exitosa sin novedades');

