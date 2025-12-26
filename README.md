# ModoFit Web - Sistema de Suscripciones con Pasarela de Pago

## 📋 Descripción del Proyecto

**ModoFit Web** es una plataforma web pública para el gimnasio ModoFit que permite a los usuarios:
- Explorar los servicios y planes de membresía disponibles
- Registrarse y crear una cuenta personal
- Comprar membresías y productos con pago en línea
- Gestionar su perfil y ver su historial de compras

### 🎯 Objetivo Principal
Crear un sistema de suscripciones con pasarela de pago integrada (**OpenPay**) que permita a los clientes adquirir membresías del gimnasio de forma segura y automatizada.

---

## 🛠️ Tecnologías Utilizadas

### Backend
| Tecnología | Versión | Descripción |
|------------|---------|-------------|
| Node.js | 16+ | Entorno de ejecución JavaScript |
| Express.js | 4.21.x | Framework web para Node.js |
| Sequelize | 6.37.x | ORM para bases de datos SQL |
| Passport.js | 0.5.x | Middleware de autenticación |
| Tedious | 18.x | Driver para SQL Server |

### Frontend
| Tecnología | Versión | Descripción |
|------------|---------|-------------|
| Handlebars | 6.x | Motor de plantillas |
| Bootstrap | 5.3.x | Framework CSS |
| SweetAlert2 | 11.x | Alertas y modales elegantes |

### Base de Datos
| Tecnología | Descripción |
|------------|-------------|
| Microsoft SQL Server | Base de datos relacional |
| Express Session Sequelize | Almacenamiento de sesiones en BD |

### Pasarela de Pago
| Tecnología | Descripción |
|------------|-------------|
| **OpenPay** | Procesamiento de pagos con tarjeta de crédito/débito |
| OpenPay.js | SDK de JavaScript para tokenización segura |

---

## 🔐 Seguridad y Protecciones

### Autenticación y Autorización
- **Passport.js** con estrategia local para autenticación de usuarios
- Contraseñas encriptadas con **bcrypt** (salt rounds: 10)
- Sesiones seguras almacenadas en base de datos SQL Server
- Cookies firmadas con clave secreta

### Protección de Rutas
```javascript
// Middleware de autenticación
isLoggedIn     // Requiere usuario autenticado
isNotLoggedIn  // Solo usuarios no autenticados (login/registro)
```

### Seguridad en Pagos (OpenPay)
- **Tokenización de tarjetas**: Los datos de tarjeta nunca tocan nuestro servidor
- **PCI DSS Compliance**: OpenPay maneja la información sensible
- **3D Secure**: Autenticación adicional para pagos seguros
- **Antifraude**: Sistema de detección de fraude integrado

### Protecciones Adicionales
- Validación de datos con **express-validator**
- Sanitización de inputs para prevenir XSS
- Protección CSRF en formularios
- Headers de seguridad HTTP
- Rate limiting para prevenir ataques de fuerza bruta

---

## 📁 Estructura del Proyecto

```
publicmodofit/
├── .env                        # Variables de entorno (NO versionar)
├── .gitignore                  # Archivos ignorados por Git
├── package.json                # Dependencias y scripts
├── README.md                   # Este archivo
│
└── src/
    ├── index.js                # Punto de entrada de la aplicación
    │
    ├── database/               # Configuración de base de datos
    │   ├── conexionsqualize.js # Conexión Sequelize a SQL Server
    │   └── keys.js             # Configuración de conexión
    │
    ├── lib/                    # Librerías y utilidades
    │   ├── auth.js             # Middlewares de autenticación
    │   ├── handlebars.js       # Helpers de Handlebars
    │   ├── helpers.js          # Funciones auxiliares (bcrypt)
    │   └── passport.js         # Configuración de Passport.js
    │
    ├── routes/                 # Rutas de la aplicación
    │   ├── index.js            # Rutas públicas (home, servicios)
    │   ├── auth.js             # Rutas de autenticación
    │   ├── dashboard.js        # Rutas del panel de usuario
    │   └── pedidos.js          # Rutas de compras y pagos
    │
    ├── views/                  # Vistas Handlebars
    │   ├── layouts/            # Layouts principales
    │   │   ├── public.hbs      # Layout para páginas públicas
    │   │   ├── auth.hbs        # Layout para login/registro
    │   │   └── dashboard.hbs   # Layout para panel de usuario
    │   │
    │   ├── home/               # Páginas públicas
    │   │   ├── index.hbs       # Página principal
    │   │   ├── servicios.hbs   # Servicios del gimnasio
    │   │   ├── contacto.hbs    # Formulario de contacto
    │   │   └── nosotros.hbs    # Información del gimnasio
    │   │
    │   ├── auth/               # Páginas de autenticación
    │   │   ├── login.hbs       # Inicio de sesión
    │   │   ├── registro.hbs    # Registro de usuarios
    │   │   └── recuperar.hbs   # Recuperar contraseña
    │   │
    │   ├── dashboard/          # Panel del usuario
    │   │   ├── index.hbs       # Dashboard principal
    │   │   ├── perfil.hbs      # Editar perfil
    │   │   ├── membresias.hbs  # Historial de membresías
    │   │   └── pedidos.hbs     # Historial de pedidos
    │   │
    │   ├── pedidos/            # Proceso de compra
    │   │   ├── index.hbs       # Catálogo de productos
    │   │   ├── carrito.hbs     # Carrito de compras
    │   │   ├── checkout.hbs    # Proceso de pago
    │   │   └── confirmacion.hbs # Confirmación de compra
    │   │
    │   └── errors/             # Páginas de error
    │       └── 404.hbs         # Página no encontrada
    │
    └── public/                 # Archivos estáticos
        ├── css/
        │   ├── styles.css      # Estilos generales
        │   ├── auth.css        # Estilos de autenticación
        │   └── dashboard.css   # Estilos del dashboard
        │
        ├── js/
        │   ├── main.js         # JavaScript principal
        │   ├── auth.js         # JavaScript de autenticación
        │   └── dashboard.js    # JavaScript del dashboard
        │
        └── img/
            ├── usuarios/       # Fotos de perfil
            └── productos/      # Imágenes de productos
```

---

## 🏗️ Arquitectura

### Patrón MVC (Model-View-Controller)
```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE                               │
│                   (Navegador Web)                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     EXPRESS.JS                               │
│                   (Servidor Web)                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   ROUTES    │  │ MIDDLEWARE  │  │   STATIC    │         │
│  │  /auth      │  │  Passport   │  │   /public   │         │
│  │  /dashboard │  │  Session    │  │   CSS/JS    │         │
│  │  /pedidos   │  │  Flash      │  │   Images    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      SEQUELIZE                               │
│                   (ORM - Modelos)                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   SQL SERVER                                 │
│              (Base de Datos)                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Cliente  │ │Membresia │ │  Pedido  │ │ Producto │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Pago con OpenPay
```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Usuario │────▶│ Frontend │────▶│ OpenPay  │────▶│ Backend  │
│          │     │(Checkout)│     │  (Token) │     │(Procesar)│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                                                   │
     │           1. Ingresa datos de tarjeta             │
     │           2. OpenPay.js tokeniza                  │
     │           3. Token enviado al servidor            │
     │           4. Backend procesa con API OpenPay      │
     │           5. Confirmación de pago                 │
     ◀───────────────────────────────────────────────────┘
```

---

## 💳 Integración con OpenPay

### Configuración Requerida (.env)
```env
# OpenPay Sandbox (Desarrollo)
OPENPAY_MERCHANT_ID=tu_merchant_id
OPENPAY_PRIVATE_KEY=tu_private_key
OPENPAY_PUBLIC_KEY=tu_public_key
OPENPAY_SANDBOX=true

# OpenPay Producción
# OPENPAY_SANDBOX=false
```

### Funcionalidades de Pago
1. **Cargo único**: Pago de membresías
2. **Suscripciones**: Cobros recurrentes mensuales
3. **Tarjetas guardadas**: Para pagos futuros rápidos
4. **Webhooks**: Notificaciones de eventos de pago

### Métodos de Pago Soportados
- Tarjetas de crédito (Visa, Mastercard, AMEX)
- Tarjetas de débito
- Transferencia SPEI (próximamente)
- Tiendas de conveniencia (próximamente)

---

## 🚀 Instalación y Ejecución

### Requisitos Previos
- Node.js 16+
- SQL Server
- Cuenta de OpenPay (Sandbox para desarrollo)

### Instalación
```bash
# Clonar el repositorio
git clone [url-del-repositorio]
cd publicmodofit

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales
```

### Ejecución
```bash
# Desarrollo (con nodemon)
npm run dev

# Producción
npm start
```

### URLs de Acceso
- **Desarrollo**: http://localhost:3300
- **Producción**: https://modofit.pe (pendiente)

---

## 📝 Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm start` | Inicia el servidor en producción |
| `npm run dev` | Inicia el servidor con nodemon (desarrollo) |

---

## 🔄 Flujo de Usuario

### 1. Visitante → Cliente
```
Visita web → Explora servicios → Selecciona plan → Registro → Pago → Cliente activo
```

### 2. Cliente Existente
```
Login → Dashboard → Ver membresía → Renovar/Comprar → Pago → Confirmación
```

### 3. Proceso de Compra
```
1. Seleccionar membresía/producto
2. Agregar al carrito
3. Ir al checkout
4. Ingresar datos de pago (OpenPay.js tokeniza)
5. Confirmar pago
6. Recibir confirmación por email
7. Membresía activada automáticamente
```

---

## 📊 Base de Datos

### Tablas Principales
| Tabla | Descripción |
|-------|-------------|
| Cliente | Usuarios registrados |
| Membresia | Membresías de clientes |
| TipoMembresia | Planes disponibles |
| Pedido | Órdenes de compra |
| DetallePedido | Items de cada pedido |
| Producto | Productos adicionales |
| PagoOpenPay | Registro de transacciones |

---

## 🔮 Roadmap

### Fase 1 - MVP (Actual)
- [x] Página principal
- [x] Sistema de autenticación
- [x] Catálogo de membresías
- [x] Carrito de compras
- [x] Dashboard de usuario
- [ ] Integración OpenPay

### Fase 2 - Mejoras
- [ ] Suscripciones recurrentes
- [ ] Notificaciones por email
- [ ] Notificaciones WhatsApp
- [ ] Reserva de clases online
- [ ] App móvil (React Native)

### Fase 3 - Expansión
- [ ] Multi-sede
- [ ] Programa de referidos
- [ ] Tienda online completa
- [ ] Integración con wearables

---

## 👥 Contribuidores

- **ModoFit Team** - Desarrollo y mantenimiento

---

## 📄 Licencia

Este proyecto es privado y propietario de ModoFit. Todos los derechos reservados.

---

## 📞 Soporte

Para soporte técnico o consultas:
- Email: soporte@modofit.pe
- WhatsApp: +51 963 061 209
