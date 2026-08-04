import fs from 'fs';
import path from 'path';
import pool from '../config/db';

async function setupDatabase() {
  console.log('Iniciando configuración de la base de datos...');
  try {
    const initSqlPath = path.join(__dirname, 'init.sql');
    const seedSqlPath = path.join(__dirname, 'seed.sql');

    console.log(`Leyendo ${initSqlPath}...`);
    const initSql = fs.readFileSync(initSqlPath, 'utf8');
    
    console.log(`Leyendo ${seedSqlPath}...`);
    const seedSql = fs.readFileSync(seedSqlPath, 'utf8');

    console.log('Ejecutando init.sql (Creación de tablas)...');
    await pool.query(initSql);
    console.log('Tablas creadas exitosamente.');

    console.log('Ejecutando seed.sql (Inserción de datos de prueba)...');
    await pool.query(seedSql);
    console.log('Datos de prueba insertados exitosamente.');

    console.log('La base de datos se ha inicializado correctamente.');
  } catch (error: any) {
    console.error('Error al inicializar la base de datos:', error.message);
  } finally {
    await pool.end();
  }
}

setupDatabase();
