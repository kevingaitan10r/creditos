Sistema de Gestión de Microcréditos

Este repositorio contiene el código fuente completo para el **Sistema de Gestión de Microcréditos Zenu**. El proyecto está estructurado como una aplicación multi-módulo que consta de:

1. **`backend/`**: API REST en Node.js, Express y TypeScript.
2. **`admin-web/`**: Panel de administración web construido en React, TypeScript, Vite y Capacitor para su compilación nativa en Android.
3. **Base de Datos**: PostgreSQL inicializado de forma automatizada mediante Docker.

---

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado lo siguiente en tu máquina local:

*   [Node.js](https://nodejs.org/) (Versión 18 o superior recomendada) y `npm`.
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Para levantar la base de datos fácilmente).
*   *Opcional (si no usas Docker)*: Una instancia local de [PostgreSQL](https://www.postgresql.org/).
*   *Opcional (para desarrollo móvil)*: [Android Studio](https://developer.android.com/studio) y el SDK de Android configurado.

---

## 🚀 Guía de Inicio Rápido en Local

Sigue los siguientes pasos en orden para levantar todo el ecosistema de Zenu.

### Paso 1: Configurar la Base de Datos (PostgreSQL)

La forma más rápida y recomendada de iniciar la base de datos es utilizando **Docker Compose**. Esto creará un contenedor de PostgreSQL e importará automáticamente las tablas y datos de prueba.

1. Abre una terminal en la raíz del proyecto.
2. Ejecuta el siguiente comando para levantar el contenedor en segundo plano:
   ```bash
   docker-compose up -d
   ```
3. Docker descargará la imagen oficial de PostgreSQL 15, creará el contenedor llamado `zenu-postgres` y ejecutará los scripts de inicialización de la base de datos en orden:
   *   `backend/src/database/init.sql` (Estructura de tablas, relaciones y restricciones)
   *   `backend/src/database/seed.sql` (Usuarios, clientes, rutas y créditos de prueba)

> [!NOTE]
> **¿Sin Docker? Inicialización Manual:**
> Si prefieres usar una base de datos PostgreSQL instalada en tu sistema:
> 1. Crea una base de datos llamada `zenu_db`.
> 2. Crea un usuario llamado `zenu_admin` con contraseña `zenu_secure_pass` (o configura tus propias credenciales y actualiza el archivo `.env` del backend).
> 3. Ejecuta en tu base de datos el contenido del archivo [init.sql](file:///c:/Users/Kevin/OneDrive/Escritorio/zenu/backend/src/database/init.sql) y luego el del archivo [seed.sql](file:///c:/Users/Kevin/OneDrive/Escritorio/zenu/backend/src/database/seed.sql).

---

### Paso 2: Configurar e Iniciar el Servidor Backend

El servidor backend expone la API REST que consume la aplicación administrativa.

1. Dirígete a la carpeta del backend:
   ```bash
   cd backend
   ```
2. Instala las dependencias necesarias:
   ```bash
   npm install
   ```
3. Crea tu archivo de configuración de variables de entorno a partir del archivo de ejemplo:
   *   En Windows (PowerShell):
       ```powershell
       Copy-Item .env.example .env
       ```
   *   En macOS/Linux:
       ```bash
       cp .env.example .env
       ```
4. Abre el archivo `.env` recién creado y verifica que las credenciales de conexión coincidan con tu base de datos (por defecto están configuradas para Docker).
5. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
6. El servidor se iniciará en `http://localhost:5000`. Puedes verificar que la conexión con la base de datos es exitosa abriendo tu navegador o haciendo una petición a:
   *   [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

### Paso 3: Configurar e Iniciar el Panel Web (Frontend)

La interfaz web administrativa está desarrollada con React y Vite.

1. Dirígete a la carpeta del cliente web:
   ```bash
   cd ../admin-web
   ```
2. Instala las dependencias del frontend:
   ```bash
   npm install
   ```
3. Inicia el servidor de desarrollo de Vite:
   ```bash
   npm run dev
   ```
4. Abre en tu navegador la URL que se muestre en la terminal (usualmente [http://localhost:5173](http://localhost:5173)).

---

## 🔑 Credenciales de Acceso (Datos de Prueba)

Gracias al script de semillas (`seed.sql`), cuentas con dos usuarios listos para usar en el inicio de sesión:

| Rol | Correo Electrónico | Contraseña | Descripción |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@zenu.com` | `admin123` | Control total del sistema, reportes y configuraciones. |
| **Cobrador** | `cobrador@zenu.com` | `cobrador123` | Gestión de rutas de cobro, abonos y gastos del día. |

---

## 📱 Configuración para Dispositivos Móviles (Capacitor)

El frontend contiene la integración con Capacitor para compilarse como una aplicación móvil nativa de Android.

Si vas a probar el proyecto en un emulador o un celular físico conectado a tu PC, ten en cuenta la configuración de red para conectarse a la API:

1. **Configuración de la API en el Móvil:**
   En [App.tsx](file:///c:/Users/Kevin/OneDrive/Escritorio/zenu/admin-web/src/App.tsx#L25-L38) el endpoint de la API se detecta dinámicamente:
   *   Si corres en la web local de la PC, apunta a `http://localhost:5000/api`.
   *   Si ejecutas en un **Emulador de Android**, apunta automáticamente a `http://10.0.2.2:5000/api` (la dirección de puente de red del emulador hacia la máquina host).
   *   Si utilizas un **Dispositivo Físico**, asegúrate de que tanto el celular como la PC estén en la misma red Wi-Fi y modifica temporalmente la dirección IP local de tu PC en [App.tsx](file:///c:/Users/Kevin/OneDrive/Escritorio/zenu/admin-web/src/App.tsx#L28) (ej: `http://192.168.1.50:5000/api`).

2. **Compilar y Sincronizar en Android:**
   Si deseas sincronizar y abrir el proyecto de Android Studio:
   ```bash
   # Construir el bundle web
   npm run build
   
   # Sincronizar los archivos web con el proyecto nativo de Android
   npx cap sync
   
   # Abrir el proyecto en Android Studio
   npx cap open android
   ```

---

## 🛠️ Solución de Problemas Comunes

*   **Error: *`connect ECONNREFUSED 127.0.0.1:5432`***
    *   *Causa:* La base de datos PostgreSQL no está corriendo.
    *   *Solución:* Asegúrate de iniciar Docker Desktop y ejecutar `docker-compose up -d`. Si utilizas una base de datos manual, valida que el servicio de PostgreSQL esté iniciado en tu sistema operativo.
*   **El puerto 5000 ya está ocupado**
    *   *Causa:* Otro servicio en tu computadora está usando el puerto 5000 (común en macOS con el servicio AirPlay Receiver).
    *   *Solución:* Puedes cambiar el puerto en tu archivo `.env` del backend (ej: `PORT=5001`) y actualizar la constante de conexión correspondiente en la aplicación cliente [App.tsx](file:///c:/Users/Kevin/OneDrive/Escritorio/zenu/admin-web/src/App.tsx#L35).
