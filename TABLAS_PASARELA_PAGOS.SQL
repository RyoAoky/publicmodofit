USE [ModoFit]
GO

/* ==========================================================================
   SISTEMA MODOFIT - MÓDULO DE PASARELA DE PAGOS
   Diseñado para SQL Server
   Fecha: 25/12/2025
   
   TABLAS INCLUIDAS:
   - Configuración de pasarelas (Openpay, Niubiz, Stripe, etc.)
   - Sesiones de pago y dispositivos
   - Caja virtual automática
   - Clientes y tarjetas tokenizadas
   - Transacciones y webhooks
   - Suscripciones recurrentes
   ========================================================================== */

-- ============================================================================
-- 1. CONFIGURACIÓN MAESTRA DE PASARELAS
-- ============================================================================
CREATE TABLE [dbo].[PasarelaPago](
    [idpasarela] [int] IDENTITY(1,1) NOT NULL,
    [nompasarela] [varchar](50) NOT NULL,           -- 'Openpay', 'Niubiz', 'Stripe'
    [codpasarela] [varchar](20) NOT NULL,           -- Código interno: 'OPP', 'NIU', 'STR'
    [ambiente] [varchar](20) DEFAULT 'SANDBOX',     -- 'SANDBOX', 'PRODUCTION'
    
    -- Credenciales API (Encriptadas en producción)
    [merchantid] [varchar](100) NULL,
    [publickey] [varchar](255) NULL,
    [privatekey] [varchar](255) NULL,
    [apikey] [varchar](255) NULL,
    
    -- Configuración Financiera Base
    [comisionporc] [decimal](12,4) DEFAULT 0.00,    -- Ej: 3.99%
    [comisionfija] [decimal](12,2) DEFAULT 0.00,    -- Ej: 1.00 Sol
    [impuestoporc] [decimal](12,2) DEFAULT 18.00,   -- IGV sobre la comisión
    [moneda] [varchar](3) DEFAULT 'PEN',
    
    -- Endpoints
    [urlapibase] [varchar](255) NULL,
    [idwebhook] [varchar](100) NULL,
    [urlwebhook] [varchar](255) NULL,
    [urlcheckout] [varchar](255) NULL,
    
    -- Auditoría
    [estado] [char](1) DEFAULT 'S',                 -- S: Activo, N: Inactivo
    [idusu] [int] NULL,
    [feccre] [datetime] DEFAULT GETDATE(),
    [fecmov] [datetime] NULL,
    
    CONSTRAINT [PK_PasarelaPago] PRIMARY KEY CLUSTERED ([idpasarela] ASC)
) ON [PRIMARY]
GO

-- ============================================================================
-- 2. CATÁLOGO DE TIPOS DE TRANSACCIÓN
-- ============================================================================
CREATE TABLE [dbo].[PasarelaTipoTransaccion](
    [idtipotrans] [int] IDENTITY(1,1) NOT NULL,
    [codtipotrans] [varchar](20) NOT NULL,          -- 'COBRO', 'SUSCRIPCION', 'REEMBOLSO'
    [destipotrans] [varchar](100) NULL,
    [estado] [char](1) DEFAULT 'S',
    [feccre] [datetime] DEFAULT GETDATE(),
    
    CONSTRAINT [PK_PasarelaTipoTransaccion] PRIMARY KEY CLUSTERED ([idtipotrans] ASC),
    CONSTRAINT [UQ_PasarelaTipoTransaccion_Codigo] UNIQUE ([codtipotrans])
) ON [PRIMARY]
GO

-- Insertar tipos básicos
INSERT INTO [dbo].[PasarelaTipoTransaccion] ([codtipotrans], [destipotrans]) VALUES
('COBRO', 'Cobro único'),
('SUSCRIPCION', 'Pago de suscripción recurrente'),
('REEMBOLSO', 'Devolución de dinero'),
('PRECOBRO', 'Pre-autorización de cobro'),
('CAPTURA', 'Captura de pre-autorización');
GO

-- ============================================================================
-- 3. CATÁLOGO DE ESTADOS DE TRANSACCIÓN (Por Pasarela)
-- ============================================================================
CREATE TABLE [dbo].[PasarelaEstado](
    [idestadopas] [int] IDENTITY(1,1) NOT NULL,
    [idpasarela] [int] NOT NULL,
    
    -- Mapeo con pasarela externa
    [codestadoext] [varchar](50) NOT NULL,          -- Lo que envía Openpay: 'charged', 'declined'
    [codestadoint] [varchar](20) NOT NULL,          -- Código interno normalizado
    
    -- Visualización Web
    [desestado] [varchar](100) NOT NULL,            -- 'Pago Exitoso', 'Tarjeta Rechazada'
    [colorhex] [varchar](10) NULL,                  -- '#28a745', '#dc3545'
    [iconclass] [varchar](50) NULL,                 -- 'fa-check', 'fa-times'
    
    -- Lógica de negocio
    [esfinal] [char](1) DEFAULT 'N',                -- S: Ya no cambia, N: Puede cambiar
    [esexitoso] [char](1) DEFAULT 'N',              -- S: Venta OK, N: Fallo
    [espendiente] [char](1) DEFAULT 'N',            -- S: En proceso
    
    [estado] [char](1) DEFAULT 'S',
    [feccre] [datetime] DEFAULT GETDATE(),
    
    CONSTRAINT [PK_PasarelaEstado] PRIMARY KEY CLUSTERED ([idestadopas] ASC),
    CONSTRAINT [FK_PasarelaEstado_Pasarela] FOREIGN KEY ([idpasarela]) 
        REFERENCES [dbo].[PasarelaPago]([idpasarela])
) ON [PRIMARY]
GO

-- ============================================================================
-- 4. HOMOLOGACIÓN DE ERRORES (Mensajes unificados para el usuario)
-- ============================================================================
CREATE TABLE [dbo].[PasarelaHomologacionError](
    [idhomologerror] [int] IDENTITY(1,1) NOT NULL,
    [idpasarela] [int] NOT NULL,
    
    -- Código de error de la pasarela
    [coderrorext] [varchar](50) NOT NULL,           -- '3001', '190', 'card_declined'
    [deserrorext] [varchar](255) NULL,              -- Descripción original de la pasarela
    
    -- Código interno unificado
    [coderrorint] [varchar](30) NOT NULL,           -- 'FONDOS_INSUF', 'TARJETA_BLOQ', 'DATOS_INVALIDOS'
    
    -- Categoría del error
    [categoriaerror] [varchar](30) NOT NULL,        -- 'TARJETA', 'BANCO', 'FRAUDE', 'SISTEMA', 'USUARIO'
    
    -- Mensajes para el usuario (UX)
    [msgusuario] [varchar](255) NOT NULL,           -- 'Tu tarjeta no tiene fondos suficientes'
    [msgusuariodetalle] [varchar](500) NULL,        -- 'Intenta con otra tarjeta o contacta a tu banco'
    
    -- Acciones sugeridas
    [accionsugerida] [varchar](50) NULL,            -- 'REINTENTAR', 'CAMBIAR_TARJETA', 'CONTACTAR_BANCO', 'VERIFICAR_DATOS'
    [permitereintento] [char](1) DEFAULT 'S',       -- S: Puede reintentar, N: No tiene sentido
    [maxreintentos] [int] DEFAULT 3,
    
    -- Visualización
    [colorhex] [varchar](10) NULL,                  -- '#dc3545' para errores
    [iconclass] [varchar](50) NULL,                 -- 'fa-exclamation-triangle'
    
    -- Severidad para alertas internas
    [severidad] [varchar](10) DEFAULT 'MEDIA',      -- 'BAJA', 'MEDIA', 'ALTA', 'CRITICA'
    [notificaradmin] [char](1) DEFAULT 'N',         -- S: Alertar al admin (ej: posible fraude)
    
    [estado] [char](1) DEFAULT 'S',
    [feccre] [datetime] DEFAULT GETDATE(),
    [fecmov] [datetime] NULL,
    
    CONSTRAINT [PK_PasarelaHomologacionError] PRIMARY KEY CLUSTERED ([idhomologerror] ASC),
    CONSTRAINT [FK_PasarelaHomologError_Pasarela] FOREIGN KEY ([idpasarela]) 
        REFERENCES [dbo].[PasarelaPago]([idpasarela]),
    CONSTRAINT [UQ_PasarelaHomologError_CodPas] UNIQUE ([idpasarela], [coderrorext])
) ON [PRIMARY]
GO

-- Índice para búsqueda rápida por código interno
CREATE NONCLUSTERED INDEX [IX_PasarelaHomologError_CodInt] 
ON [dbo].[PasarelaHomologacionError]([coderrorint])
GO

-- ============================================================================
-- 5. MARCAS DE TARJETA
-- ============================================================================
CREATE TABLE [dbo].[PasarelaMarcaTarjeta](
    [idmarcatarj] [int] IDENTITY(1,1) NOT NULL,
    [idpasarela] [int] NOT NULL,
    [codmarcaext] [varchar](50) NOT NULL,           -- 'visa', 'mastercard', 'amex'
    [desmarca] [varchar](50) NULL,                  -- 'Visa', 'Mastercard'
    [urllogo] [varchar](255) NULL,
    [colorfondo] [varchar](10) NULL,
    [estado] [char](1) DEFAULT 'S',
    [feccre] [datetime] DEFAULT GETDATE(),
    
    CONSTRAINT [PK_PasarelaMarcaTarjeta] PRIMARY KEY CLUSTERED ([idmarcatarj] ASC),
    CONSTRAINT [FK_PasarelaMarcaTarjeta_Pasarela] FOREIGN KEY ([idpasarela]) 
        REFERENCES [dbo].[PasarelaPago]([idpasarela])
) ON [PRIMARY]
GO

-- ============================================================================
-- 6. CAJA VIRTUAL (Para pagos online - Se abre/cierra automáticamente por día)
-- ============================================================================
CREATE TABLE [dbo].[CajaVirtual](
    [idcajavirtual] [int] IDENTITY(1,1) NOT NULL,
    [idpasarela] [int] NOT NULL,
    [fecoperacion] [date] NOT NULL,                 -- Fecha de operación (día)
    
    -- Horarios automáticos
    [apertura] [datetime] NOT NULL,                 -- Primera transacción del día
    [cierre] [datetime] NULL,                       -- Última transacción o cierre automático
    
    -- Totales del día
    [canttransacciones] [int] DEFAULT 0,
    [montbruto] [decimal](12,2) DEFAULT 0.00,       -- Total cobrado a clientes
    [montcomision] [decimal](12,2) DEFAULT 0.00,    -- Total comisiones pasarela
    [montimpuesto] [decimal](12,2) DEFAULT 0.00,    -- Total IGV sobre comisiones
    [montneto] [decimal](12,2) DEFAULT 0.00,        -- Neto a recibir
    
    -- Conciliación con banco
    [fecconciliacion] [datetime] NULL,
    [montconciliado] [decimal](12,2) NULL,
    [diferenciaconcil] [decimal](12,2) NULL,
    [obsconciliacion] [varchar](500) NULL,
    
    -- Estado
    [estcajavirtual] [char](1) DEFAULT 'A',         -- A: Abierta, C: Cerrada, R: Conciliada
    [idusu] [int] NULL,
    [feccre] [datetime] DEFAULT GETDATE(),
    [fecmov] [datetime] NULL,
    
    CONSTRAINT [PK_CajaVirtual] PRIMARY KEY CLUSTERED ([idcajavirtual] ASC),
    CONSTRAINT [FK_CajaVirtual_Pasarela] FOREIGN KEY ([idpasarela]) 
        REFERENCES [dbo].[PasarelaPago]([idpasarela]),
    CONSTRAINT [UQ_CajaVirtual_FechaPasarela] UNIQUE ([idpasarela], [fecoperacion])
) ON [PRIMARY]
GO

-- ============================================================================
-- 7. RELACIÓN CAJA FÍSICA - CAJA VIRTUAL (Para cuadres diarios)
-- ============================================================================
CREATE TABLE [dbo].[CajaCajaVirtual](
    [idcajacajavirtual] [int] IDENTITY(1,1) NOT NULL,
    [idcaja] [int] NOT NULL,                        -- FK a tu tabla Caja existente
    [idcajavirtual] [int] NOT NULL,
    [monttransferido] [decimal](12,2) DEFAULT 0.00,
    [feccre] [datetime] DEFAULT GETDATE(),
    [idusu] [int] NULL,
    
    CONSTRAINT [PK_CajaCajaVirtual] PRIMARY KEY CLUSTERED ([idcajacajavirtual] ASC),
    CONSTRAINT [FK_CajaCajaVirtual_Caja] FOREIGN KEY ([idcaja]) 
        REFERENCES [dbo].[Caja]([idcaja]),
    CONSTRAINT [FK_CajaCajaVirtual_CajaVirtual] FOREIGN KEY ([idcajavirtual]) 
        REFERENCES [dbo].[CajaVirtual]([idcajavirtual])
) ON [PRIMARY]
GO

-- ============================================================================
-- 8. PLANES DE SUSCRIPCIÓN (Vinculación con Productos/Membresías)
-- ============================================================================
CREATE TABLE [dbo].[PasarelaPlan](
    [idplanpas] [int] IDENTITY(1,1) NOT NULL,
    [idpasarela] [int] NOT NULL,
    
    -- Vinculación con tu sistema
    [barcpro] [varchar](100) NOT NULL,              -- FK a Producto (Membresía)
    
    -- Datos en la pasarela externa
    [codplanext] [varchar](100) NOT NULL,           -- 'pln_xxxxx' en Openpay
    [nomplanext] [varchar](150) NULL,
    [moneda] [varchar](3) DEFAULT 'PEN',
    [precio] [decimal](12,2) NOT NULL,
    
    -- Reglas de recurrencia
    [frecuencianum] [int] NOT NULL DEFAULT 1,       -- Cada cuántos
    [frecuenciaunidad] [varchar](20) NOT NULL,      -- 'day', 'week', 'month', 'year'
    [diasprueba] [int] DEFAULT 0,
    [intentosrecobro] [int] DEFAULT 3,              -- Reintentos si falla
    
    [estado] [char](1) DEFAULT 'S',
    [idusu] [int] NULL,
    [feccre] [datetime] DEFAULT GETDATE(),
    [fecmov] [datetime] NULL,
    
    CONSTRAINT [PK_PasarelaPlan] PRIMARY KEY CLUSTERED ([idplanpas] ASC),
    CONSTRAINT [FK_PasarelaPlan_Pasarela] FOREIGN KEY ([idpasarela]) 
        REFERENCES [dbo].[PasarelaPago]([idpasarela]),
    CONSTRAINT [FK_PasarelaPlan_Producto] FOREIGN KEY ([barcpro]) 
        REFERENCES [dbo].[Producto]([barcpro])
) ON [PRIMARY]
GO

-- ============================================================================
-- 9. CLIENTES EN PASARELA (Vinculación Usuario ModoFit <-> Customer ID Externo)
--    Permite historial: múltiples registros inactivos, solo uno activo por usuario
-- ============================================================================
CREATE TABLE [dbo].[PasarelaCliente](
    [idclipas] [int] IDENTITY(1,1) NOT NULL,
    [idpasarela] [int] NOT NULL,
    
    -- Vinculación con tu sistema
    [idusu] [int] NOT NULL,                         -- FK a Usuario
    [dniusu] [varchar](10) NOT NULL,
    
    -- Datos en la pasarela externa
    [idcliext] [varchar](100) NOT NULL,             -- 'cus_xxxxx' en Openpay
    [emailregistrado] [varchar](150) NULL,
    [telefonoregistrado] [varchar](20) NULL,
    
    -- Auditoría de desafiliación
    [fecdesafiliacion] [datetime] NULL,             -- Cuándo se desafilió
    [motivodesafiliacion] [varchar](200) NULL,      -- Motivo de la desafiliación
    
    [estado] [char](1) DEFAULT 'S',                 -- S: Activo, N: Inactivo (histórico)
    [feccre] [datetime] DEFAULT GETDATE(),
    [fecmov] [datetime] NULL,
    
    CONSTRAINT [PK_PasarelaCliente] PRIMARY KEY CLUSTERED ([idclipas] ASC),
    CONSTRAINT [FK_PasarelaCliente_Pasarela] FOREIGN KEY ([idpasarela]) 
        REFERENCES [dbo].[PasarelaPago]([idpasarela]),
    CONSTRAINT [FK_PasarelaCliente_Usuario] FOREIGN KEY ([idusu]) 
        REFERENCES [dbo].[usuario]([idusu])
    -- NOTA: No hay UNIQUE simple. Se usa índice filtrado para permitir historial
) ON [PRIMARY]
GO

-- Índice único filtrado: garantiza solo UN registro ACTIVO por usuario/pasarela
-- Permite múltiples registros históricos (estado='N') para auditoría
CREATE UNIQUE NONCLUSTERED INDEX [IX_PasarelaCliente_UsuPasarela_Activo]
ON [dbo].[PasarelaCliente] ([idusu], [idpasarela])
WHERE [estado] = 'S';
GO
-- ============================================================================
-- 10. TARJETAS TOKENIZADAS (Nunca guardar número completo)
-- ============================================================================
CREATE TABLE [dbo].[PasarelaTarjeta](
    [idtarjpas] [int] IDENTITY(1,1) NOT NULL,
    [idclipas] [int] NOT NULL,
    [idmarcatarj] [int] NULL,
    
    -- Tokens (SEGURIDAD)
    [tokenidtemp] [varchar](100) NULL,              -- Token inicial de la sesión
    [sourceid] [varchar](100) NOT NULL,             -- 'krd_xxxxx' - Token para cobros recurrentes
    [devicesessionid] [varchar](150) NULL,          -- Anti-fraude
    
    -- Info visual (Solo últimos 4 dígitos)
    [ultimos4] [varchar](4) NULL,
    [mesexp] [varchar](2) NULL,
    [anioexp] [varchar](4) NULL,
    [nomtitular] [varchar](150) NULL,
    [tipotarjeta] [varchar](20) NULL,               -- 'debit', 'credit'
    
    -- =========================================================
    -- METADATOS BIN (Análisis de negocio y marketing)
    -- =========================================================
    [bin] [varchar](8) NULL,                        -- Primeros 6-8 dígitos (identifica banco)
    [bancoemisor] [varchar](100) NULL,              -- Ej: 'Banco de Crédito del Perú'
    [paisemisor] [varchar](3) NULL,                 -- Ej: 'PE', 'US'
    [categoriatarjeta] [varchar](50) NULL,          -- 'CLASSIC', 'GOLD', 'PLATINUM', 'CORPORATE'
    [fingerprint] [varchar](150) NULL,              -- Huella digital única de la tarjeta
    
    [espredeterminada] [char](1) DEFAULT 'N',
    [estado] [char](1) DEFAULT 'S',                 -- S: Disponible, N: Eliminada, B: Bloqueada
    [feccre] [datetime] DEFAULT GETDATE(),
    [fecmov] [datetime] NULL,
    
    CONSTRAINT [PK_PasarelaTarjeta] PRIMARY KEY CLUSTERED ([idtarjpas] ASC),
    CONSTRAINT [FK_PasarelaTarjeta_Cliente] FOREIGN KEY ([idclipas]) 
        REFERENCES [dbo].[PasarelaCliente]([idclipas]),
    CONSTRAINT [FK_PasarelaTarjeta_Marca] FOREIGN KEY ([idmarcatarj]) 
        REFERENCES [dbo].[PasarelaMarcaTarjeta]([idmarcatarj])
) ON [PRIMARY]
GO

-- ============================================================================
-- 11. SESIONES DE PAGO (Historial de intentos de pago del usuario)
-- ============================================================================
CREATE TABLE [dbo].[PasarelaSesion](
    [idsesionpas] [int] IDENTITY(1,1) NOT NULL,
    [idpasarela] [int] NOT NULL,
    [idusu] [int] NULL,                             -- Puede ser nulo si es usuario anónimo
    [dniusu] [varchar](10) NULL,
    
    -- Identificadores de sesión
    [sessionid] [varchar](100) NOT NULL,            -- ID único de sesión
    [devicesessionid] [varchar](150) NULL,          -- Anti-fraude de la pasarela
    
    -- Información del dispositivo/navegador
    [useragent] [varchar](500) NULL,
    [ipaddress] [varchar](45) NULL,                 -- IPv4 o IPv6
    [plataforma] [varchar](50) NULL,                -- 'WEB', 'MOBILE_APP', 'API'
    [navegador] [varchar](100) NULL,
    [sistemaoperativo] [varchar](100) NULL,
    
    -- Contexto del pago
    [idven] [int] NULL,                             -- FK a Venta si aplica
    [barcpro] [varchar](100) NULL,                  -- Producto que intenta comprar
    [montintentado] [decimal](12,2) NULL,
    
    -- Estado de la sesión
    [estsesion] [char](1) DEFAULT 'A',              -- A: Activa, C: Completada, E: Expirada, F: Fallida
    [fecinicio] [datetime] DEFAULT GETDATE(),
    [fecultactividad] [datetime] DEFAULT GETDATE(),
    [fecexpiracion] [datetime] NULL,
    [fecfin] [datetime] NULL,
    
    -- Resultado
    [intentospago] [int] DEFAULT 0,
    [idtranspas] [int] NULL,                        -- FK a transacción exitosa
    
    CONSTRAINT [PK_PasarelaSesion] PRIMARY KEY CLUSTERED ([idsesionpas] ASC),
    CONSTRAINT [FK_PasarelaSesion_Pasarela] FOREIGN KEY ([idpasarela]) 
        REFERENCES [dbo].[PasarelaPago]([idpasarela]),
    CONSTRAINT [FK_PasarelaSesion_Usuario] FOREIGN KEY ([idusu]) 
        REFERENCES [dbo].[usuario]([idusu]),
    CONSTRAINT [FK_PasarelaSesion_Venta] FOREIGN KEY ([idven]) 
        REFERENCES [dbo].[Venta]([idven])
) ON [PRIMARY]
GO

-- Índice para búsquedas rápidas por sessionid
CREATE NONCLUSTERED INDEX [IX_PasarelaSesion_SessionId] 
ON [dbo].[PasarelaSesion]([sessionid])
GO

-- ============================================================================
-- 12. HISTORIAL DE SESIONES POR PLATAFORMA (Auditoría detallada)
-- ============================================================================
CREATE TABLE [dbo].[PasarelaSesionHistorial](
    [idsesionhist] [int] IDENTITY(1,1) NOT NULL,
    [idsesionpas] [int] NOT NULL,
    
    -- Acción realizada
    [accion] [varchar](50) NOT NULL,                -- 'INICIO', 'TOKEN_CREADO', 'PAGO_INTENTO', 'PAGO_EXITOSO', 'PAGO_FALLIDO', 'EXPIRACION'
    [detalleaccion] [varchar](500) NULL,
    
    -- Datos del momento
    [ipaddress] [varchar](45) NULL,
    [datosadicionales] [nvarchar](max) NULL,        -- JSON con datos extra
    
    [fecaccion] [datetime] DEFAULT GETDATE(),
    
    CONSTRAINT [PK_PasarelaSesionHistorial] PRIMARY KEY CLUSTERED ([idsesionhist] ASC),
    CONSTRAINT [FK_PasarelaSesionHistorial_Sesion] FOREIGN KEY ([idsesionpas]) 
        REFERENCES [dbo].[PasarelaSesion]([idsesionpas])
) ON [PRIMARY]
GO

-- ============================================================================
-- 13. SUSCRIPCIONES ACTIVAS
-- ============================================================================
CREATE TABLE [dbo].[PasarelaSuscripcion](
    [idsuscpas] [int] IDENTITY(1,1) NOT NULL,
    [idclipas] [int] NOT NULL,
    [idplanpas] [int] NOT NULL,
    [idtarjpas] [int] NOT NULL,
    
    -- ID externo de la suscripción
    [idsuscext] [varchar](100) NOT NULL,            -- 'sub_xxxxx'
    
    -- Fechas
    [fecinicio] [datetime] NOT NULL,
    [fecproximocobro] [datetime] NULL,
    [feccancelacion] [datetime] NULL,
    [fecfinperiodo] [datetime] NULL,
    
    -- Estado
    [idestadopas] [int] NULL,                       -- FK a PasarelaEstado
    [estsuscripcion] [char](1) DEFAULT 'A',         -- A: Activa, P: Pausada, C: Cancelada, V: Vencida
    
    -- Vinculación con membresía
    [idmem] [int] NULL,                             -- FK a Membresía creada
    
    -- Contadores
    [cobrosrealizados] [int] DEFAULT 0,
    [cobrosfallidos] [int] DEFAULT 0,
    
    [idusu] [int] NULL,
    [feccre] [datetime] DEFAULT GETDATE(),
    [fecmov] [datetime] NULL,
    
    CONSTRAINT [PK_PasarelaSuscripcion] PRIMARY KEY CLUSTERED ([idsuscpas] ASC),
    CONSTRAINT [FK_PasarelaSuscripcion_Cliente] FOREIGN KEY ([idclipas]) 
        REFERENCES [dbo].[PasarelaCliente]([idclipas]),
    CONSTRAINT [FK_PasarelaSuscripcion_Plan] FOREIGN KEY ([idplanpas]) 
        REFERENCES [dbo].[PasarelaPlan]([idplanpas]),
    CONSTRAINT [FK_PasarelaSuscripcion_Tarjeta] FOREIGN KEY ([idtarjpas]) 
        REFERENCES [dbo].[PasarelaTarjeta]([idtarjpas]),
    CONSTRAINT [FK_PasarelaSuscripcion_Estado] FOREIGN KEY ([idestadopas]) 
        REFERENCES [dbo].[PasarelaEstado]([idestadopas]),
    CONSTRAINT [FK_PasarelaSuscripcion_Membresia] FOREIGN KEY ([idmem]) 
        REFERENCES [dbo].[Membresia]([idmem])
) ON [PRIMARY]
GO

-- ============================================================================
-- 14. TRANSACCIONES (TABLA CRÍTICA - Caja y Auditoría)
-- ============================================================================
CREATE TABLE [dbo].[PasarelaTransaccion](
    [idtranspas] [int] IDENTITY(1,1) NOT NULL,
    [idpasarela] [int] NOT NULL,
    [idcajavirtual] [int] NULL,                     -- FK a CajaVirtual del día
    
    -- Vinculación con sistema ModoFit
    [idusu] [int] NOT NULL,                         -- Usuario que paga
    [dniusu] [varchar](10) NOT NULL,
    [idven] [int] NULL,                             -- FK a Venta generada
    [idmem] [int] NULL,                             -- FK a Membresía generada
    [idsuscpas] [int] NULL,                         -- FK a Suscripción si es recurrente
    [idsesionpas] [int] NULL,                       -- FK a Sesión de pago
    
    -- IDs externos
    [idtransext] [varchar](100) NULL,               -- 'tr_xxxxx' de Openpay
    [referenciaorden] [varchar](50) NULL,           -- Referencia interna
    
    -- Clasificación
    [idtipotrans] [int] NOT NULL,                   -- FK a TipoTransaccion
    [idestadopas] [int] NOT NULL,                   -- FK a Estado
    
    -- =========================================================
    -- DETALLE FINANCIERO
    -- =========================================================
    [moneda] [varchar](3) DEFAULT 'PEN',
    [montbruto] [decimal](12,2) NOT NULL,           -- Lo que paga el cliente
    
    -- Comisiones de la pasarela (calculadas al momento)
    [porccomision] [decimal](12,4) DEFAULT 0,       -- % aplicado
    [montcomisionvar] [decimal](12,2) DEFAULT 0,    -- Comisión variable
    [montcomisionfija] [decimal](12,2) DEFAULT 0,   -- Comisión fija
    [montimpuestocom] [decimal](12,2) DEFAULT 0,    -- IGV sobre comisión
    [monttotaldesc] [decimal](12,2) DEFAULT 0,      -- Total descontado
    [montneto] [decimal](12,2) DEFAULT 0,           -- Neto a recibir en banco
    
    -- Info de tarjeta usada (sin datos sensibles)
    [idtarjpas] [int] NULL,
    [ultimos4tarj] [varchar](4) NULL,
    [marcatarj] [varchar](20) NULL,
    
    -- =========================================================
    -- PAGOS OFFLINE (PagoEfectivo / CIP / Transferencias)
    -- =========================================================
    [codigopago] [varchar](50) NULL,               -- Código CIP o referencia PagoEfectivo
    [urlrecibo] [varchar](500) NULL,               -- URL al PDF o código de barras
    [feclimitepago] [datetime] NULL,               -- Hasta cuándo es válido el código
    [codautorizacion] [varchar](50) NULL,          -- Auth Code del banco
    [metododepago] [varchar](30) NULL,             -- 'TARJETA', 'EFECTIVO', 'TRANSFERENCIA', 'QR'
    
    -- =========================================================
    -- IDEMPOTENCIA Y SEGURIDAD (3D Secure / Anti-Fraude)
    -- =========================================================
    [idempotencykey] [varchar](100) NULL,          -- Clave única para evitar doble cobro
    [requiere3ds] [char](1) DEFAULT 'N',           -- S: Requirió autenticación 3D Secure
    [paso3ds] [char](1) DEFAULT 'N',               -- S: Usuario se autenticó correctamente
    [version3ds] [varchar](10) NULL,               -- '1.0', '2.0', '2.1', '2.2'
    [riesgoscore] [decimal](5,2) NULL,             -- Score de fraude (0-100)
    [riesgonivel] [varchar](20) NULL,              -- 'LOW', 'MEDIUM', 'HIGH'
    
    -- =========================================================
    -- MULTIMONEDA (Tipo de cambio)
    -- =========================================================
    [monedaorigen] [varchar](3) NULL,              -- Moneda original del cobro
    [montoriginal] [decimal](12,2) NULL,           -- Monto en moneda original
    [tipocambio] [decimal](10,4) DEFAULT 1.0000,   -- T.C. del momento de la transacción
    
    -- Respuesta de la pasarela
    [jsonresponse] [nvarchar](max) NULL,
    [coderrorpas] [varchar](50) NULL,
    [msgerrorpas] [varchar](255) NULL,
    
    -- Auditoría
    [ipaddress] [varchar](45) NULL,
    [useragent] [varchar](500) NULL,
    
    [estado] [char](1) DEFAULT 'S',
    [fectransaccion] [datetime] DEFAULT GETDATE(),
    [fecmov] [datetime] NULL,
    
    CONSTRAINT [PK_PasarelaTransaccion] PRIMARY KEY CLUSTERED ([idtranspas] ASC),
    CONSTRAINT [FK_PasarelaTransaccion_Pasarela] FOREIGN KEY ([idpasarela]) 
        REFERENCES [dbo].[PasarelaPago]([idpasarela]),
    CONSTRAINT [FK_PasarelaTransaccion_CajaVirtual] FOREIGN KEY ([idcajavirtual]) 
        REFERENCES [dbo].[CajaVirtual]([idcajavirtual]),
    CONSTRAINT [FK_PasarelaTransaccion_Usuario] FOREIGN KEY ([idusu]) 
        REFERENCES [dbo].[usuario]([idusu]),
    CONSTRAINT [FK_PasarelaTransaccion_Venta] FOREIGN KEY ([idven]) 
        REFERENCES [dbo].[Venta]([idven]),
    CONSTRAINT [FK_PasarelaTransaccion_Membresia] FOREIGN KEY ([idmem]) 
        REFERENCES [dbo].[Membresia]([idmem]),
    CONSTRAINT [FK_PasarelaTransaccion_Suscripcion] FOREIGN KEY ([idsuscpas]) 
        REFERENCES [dbo].[PasarelaSuscripcion]([idsuscpas]),
    CONSTRAINT [FK_PasarelaTransaccion_Sesion] FOREIGN KEY ([idsesionpas]) 
        REFERENCES [dbo].[PasarelaSesion]([idsesionpas]),
    CONSTRAINT [FK_PasarelaTransaccion_TipoTrans] FOREIGN KEY ([idtipotrans]) 
        REFERENCES [dbo].[PasarelaTipoTransaccion]([idtipotrans]),
    CONSTRAINT [FK_PasarelaTransaccion_Estado] FOREIGN KEY ([idestadopas]) 
        REFERENCES [dbo].[PasarelaEstado]([idestadopas]),
    CONSTRAINT [FK_PasarelaTransaccion_Tarjeta] FOREIGN KEY ([idtarjpas]) 
        REFERENCES [dbo].[PasarelaTarjeta]([idtarjpas])
) ON [PRIMARY]
GO

-- Índices para reportes y búsquedas
CREATE NONCLUSTERED INDEX [IX_PasarelaTransaccion_Fecha] 
ON [dbo].[PasarelaTransaccion]([fectransaccion])
GO

CREATE NONCLUSTERED INDEX [IX_PasarelaTransaccion_Usuario] 
ON [dbo].[PasarelaTransaccion]([idusu], [fectransaccion])
GO

CREATE NONCLUSTERED INDEX [IX_PasarelaTransaccion_IdExt] 
ON [dbo].[PasarelaTransaccion]([idtransext])
GO

-- ============================================================================
-- 15. LOGS DE WEBHOOKS (Recepción de notificaciones)
-- ============================================================================
CREATE TABLE [dbo].[PasarelaWebhookLog](
    [idwebhooklog] [int] IDENTITY(1,1) NOT NULL,
    [idpasarela] [int] NULL,
    
    -- Evento recibido
    [tipoevento] [varchar](100) NULL,               -- 'charge.succeeded', 'subscription.cancelled'
    [payloadjson] [nvarchar](max) NULL,
    
    -- Datos extraídos
    [idtransext] [varchar](100) NULL,
    [idcliext] [varchar](100) NULL,
    
    -- Procesamiento
    [procesado] [char](1) DEFAULT 'N',              -- S: Procesado, N: Pendiente, E: Error
    [msgproceso] [varchar](max) NULL,
    [fecproceso] [datetime] NULL,
    
    -- Seguridad
    [signature] [varchar](255) NULL,                -- Firma del webhook para validación
    [iporigin] [varchar](45) NULL,
    
    [estado] [char](1) DEFAULT 'S',
    [fecrecepcion] [datetime] DEFAULT GETDATE(),
    
    CONSTRAINT [PK_PasarelaWebhookLog] PRIMARY KEY CLUSTERED ([idwebhooklog] ASC),
    CONSTRAINT [FK_PasarelaWebhookLog_Pasarela] FOREIGN KEY ([idpasarela]) 
        REFERENCES [dbo].[PasarelaPago]([idpasarela])
) ON [PRIMARY]
GO

-- ============================================================================
-- 16. LOGS DE PETICIONES API (Lo que envías a la pasarela)
-- ============================================================================
CREATE TABLE [dbo].[PasarelaApiLog](
    [idapilog] [int] IDENTITY(1,1) NOT NULL,
    [idpasarela] [int] NOT NULL,
    [idtranspas] [int] NULL,                        -- FK a transacción si aplica
    [idsesionpas] [int] NULL,                       -- FK a sesión si aplica
    
    -- Identificación de la petición
    [idempotencykey] [varchar](100) NULL,           -- Llave de idempotencia usada
    [correlationid] [varchar](100) NULL,            -- ID para rastrear peticiones relacionadas
    
    -- Endpoint y método
    [metodohttp] [varchar](10) NOT NULL,            -- 'POST', 'GET', 'PUT', 'DELETE'
    [endpoint] [varchar](500) NOT NULL,             -- URL completa del endpoint
    [operacion] [varchar](50) NULL,                 -- 'CREATE_CHARGE', 'CREATE_CUSTOMER', 'REFUND'
    
    -- Petición enviada
    [headersenviados] [nvarchar](max) NULL,         -- Headers (sin credenciales sensibles)
    [bodyenviado] [nvarchar](max) NULL,             -- JSON enviado a la pasarela
    
    -- Respuesta recibida
    [httpstatuscode] [int] NULL,                    -- 200, 400, 401, 500, etc.
    [headersrecibidos] [nvarchar](max) NULL,        -- Headers de respuesta
    [bodyrecibido] [nvarchar](max) NULL,            -- JSON recibido de la pasarela
    
    -- Tiempos
    [fecinicio] [datetime] NOT NULL,                -- Momento de envío
    [fecfin] [datetime] NULL,                       -- Momento de respuesta
    [tiemporespuestams] [int] NULL,                 -- Tiempo en milisegundos
    
    -- Resultado
    [esexitoso] [char](1) DEFAULT 'N',              -- S: Éxito, N: Fallo
    [codigoerror] [varchar](50) NULL,
    [mensajeerror] [varchar](500) NULL,
    
    -- Reintentos
    [numerointento] [int] DEFAULT 1,                -- 1, 2, 3...
    [idapilogpadre] [int] NULL,                     -- FK a petición original si es reintento
    
    -- Contexto
    [idusu] [int] NULL,                             -- Usuario que originó la petición
    [ipaddress] [varchar](45) NULL,
    [useragent] [varchar](500) NULL,
    
    CONSTRAINT [PK_PasarelaApiLog] PRIMARY KEY CLUSTERED ([idapilog] ASC),
    CONSTRAINT [FK_PasarelaApiLog_Pasarela] FOREIGN KEY ([idpasarela]) 
        REFERENCES [dbo].[PasarelaPago]([idpasarela]),
    CONSTRAINT [FK_PasarelaApiLog_Transaccion] FOREIGN KEY ([idtranspas]) 
        REFERENCES [dbo].[PasarelaTransaccion]([idtranspas]),
    CONSTRAINT [FK_PasarelaApiLog_Sesion] FOREIGN KEY ([idsesionpas]) 
        REFERENCES [dbo].[PasarelaSesion]([idsesionpas]),
    CONSTRAINT [FK_PasarelaApiLog_Padre] FOREIGN KEY ([idapilogpadre]) 
        REFERENCES [dbo].[PasarelaApiLog]([idapilog])
) ON [PRIMARY]
GO

-- Índices para búsqueda rápida
CREATE NONCLUSTERED INDEX [IX_PasarelaApiLog_Transaccion] 
ON [dbo].[PasarelaApiLog]([idtranspas])
GO

CREATE NONCLUSTERED INDEX [IX_PasarelaApiLog_Fecha] 
ON [dbo].[PasarelaApiLog]([fecinicio])
GO

CREATE NONCLUSTERED INDEX [IX_PasarelaApiLog_Correlacion] 
ON [dbo].[PasarelaApiLog]([correlationid])
GO

-- ============================================================================
-- 17. NOTIFICACIONES DE PAGO (Emails, SMS enviados)
-- ============================================================================
CREATE TABLE [dbo].[PasarelaNotificacion](
    [idnotifpas] [int] IDENTITY(1,1) NOT NULL,
    [idtranspas] [int] NOT NULL,
    [idusu] [int] NOT NULL,
    
    -- Tipo y canal
    [tiponotif] [varchar](30) NOT NULL,             -- 'CONFIRMACION', 'FALLO', 'RECIBO', 'RECORDATORIO'
    [canal] [varchar](20) NOT NULL,                 -- 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH'
    
    -- Destino
    [destinatario] [varchar](150) NULL,             -- Email o teléfono
    
    -- Contenido
    [asunto] [varchar](200) NULL,
    [mensaje] [nvarchar](max) NULL,
    
    -- Estado
    [estnotif] [char](1) DEFAULT 'P',               -- P: Pendiente, E: Enviado, F: Fallido
    [msgresultado] [varchar](255) NULL,
    
    [feccre] [datetime] DEFAULT GETDATE(),
    [fecenvio] [datetime] NULL,
    
    CONSTRAINT [PK_PasarelaNotificacion] PRIMARY KEY CLUSTERED ([idnotifpas] ASC),
    CONSTRAINT [FK_PasarelaNotificacion_Transaccion] FOREIGN KEY ([idtranspas]) 
        REFERENCES [dbo].[PasarelaTransaccion]([idtranspas]),
    CONSTRAINT [FK_PasarelaNotificacion_Usuario] FOREIGN KEY ([idusu]) 
        REFERENCES [dbo].[usuario]([idusu])
) ON [PRIMARY]
GO

-- ============================================================================
-- 18. REEMBOLSOS
-- ============================================================================
CREATE TABLE [dbo].[PasarelaReembolso](
    [idreembolso] [int] IDENTITY(1,1) NOT NULL,
    [idtranspas] [int] NOT NULL,                    -- Transacción original
    [idtranspasreemb] [int] NULL,                   -- Nueva transacción de reembolso
    
    -- IDs externos
    [idreembolsoext] [varchar](100) NULL,           -- ID en la pasarela
    
    -- Montos
    [montoriginal] [decimal](12,2) NOT NULL,
    [montreembolso] [decimal](12,2) NOT NULL,       -- Puede ser parcial
    [esreembolsototal] [char](1) DEFAULT 'S',
    
    -- Motivo
    [motivo] [varchar](500) NULL,
    [codigomotivo] [varchar](50) NULL,
    
    -- Estado
    [idestadopas] [int] NULL,
    [estreembolso] [char](1) DEFAULT 'P',           -- P: Pendiente, A: Aprobado, R: Rechazado, C: Completado
    
    [idusu] [int] NOT NULL,                         -- Usuario que solicita
    [idusuprocesa] [int] NULL,                      -- Usuario que procesa
    [feccre] [datetime] DEFAULT GETDATE(),
    [fecproceso] [datetime] NULL,
    
    CONSTRAINT [PK_PasarelaReembolso] PRIMARY KEY CLUSTERED ([idreembolso] ASC),
    CONSTRAINT [FK_PasarelaReembolso_TransOriginal] FOREIGN KEY ([idtranspas]) 
        REFERENCES [dbo].[PasarelaTransaccion]([idtranspas]),
    CONSTRAINT [FK_PasarelaReembolso_TransReemb] FOREIGN KEY ([idtranspasreemb]) 
        REFERENCES [dbo].[PasarelaTransaccion]([idtranspas]),
    CONSTRAINT [FK_PasarelaReembolso_Estado] FOREIGN KEY ([idestadopas]) 
        REFERENCES [dbo].[PasarelaEstado]([idestadopas]),
    CONSTRAINT [FK_PasarelaReembolso_Usuario] FOREIGN KEY ([idusu]) 
        REFERENCES [dbo].[usuario]([idusu])
) ON [PRIMARY]
GO

-- ============================================================================
-- 19. DISPUTAS/CONTRACARGOS
-- ============================================================================
CREATE TABLE [dbo].[PasarelaDisputa](
    [iddisputa] [int] IDENTITY(1,1) NOT NULL,
    [idtranspas] [int] NOT NULL,
    
    -- IDs externos
    [iddisputaext] [varchar](100) NULL,
    
    -- Detalles
    [montodisputa] [decimal](12,2) NOT NULL,
    [motivo] [varchar](500) NULL,
    [codigomotivo] [varchar](50) NULL,
    
    -- Documentación
    [evidenciajson] [nvarchar](max) NULL,           -- Documentos subidos
    
    -- Estado
    [estdisputa] [char](1) DEFAULT 'A',             -- A: Abierta, R: En revisión, G: Ganada, P: Perdida
    
    -- Fechas límite
    [feclimiterespuesta] [datetime] NULL,
    
    [feccre] [datetime] DEFAULT GETDATE(),
    [fecresolucion] [datetime] NULL,
    
    CONSTRAINT [PK_PasarelaDisputa] PRIMARY KEY CLUSTERED ([iddisputa] ASC),
    CONSTRAINT [FK_PasarelaDisputa_Transaccion] FOREIGN KEY ([idtranspas]) 
        REFERENCES [dbo].[PasarelaTransaccion]([idtranspas])
) ON [PRIMARY]
GO

-- ============================================================================
-- 20. CONFIGURACIÓN DE REINTENTOS (Para suscripciones fallidas)
-- ============================================================================
CREATE TABLE [dbo].[PasarelaConfigReintento](
    [idconfigreint] [int] IDENTITY(1,1) NOT NULL,
    [idpasarela] [int] NOT NULL,
    
    [numintento] [int] NOT NULL,                    -- 1, 2, 3...
    [diasespera] [int] NOT NULL,                    -- Días después del fallo
    [enviarnotificacion] [char](1) DEFAULT 'S',
    [tiponotificacion] [varchar](50) NULL,          -- 'EMAIL', 'SMS'
    
    [estado] [char](1) DEFAULT 'S',
    [feccre] [datetime] DEFAULT GETDATE(),
    
    CONSTRAINT [PK_PasarelaConfigReintento] PRIMARY KEY CLUSTERED ([idconfigreint] ASC),
    CONSTRAINT [FK_PasarelaConfigReintento_Pasarela] FOREIGN KEY ([idpasarela]) 
        REFERENCES [dbo].[PasarelaPago]([idpasarela])
) ON [PRIMARY]
GO

-- ============================================================================
-- 21. AUDITORÍA GENERAL DE PASARELA
-- ============================================================================
CREATE TABLE [dbo].[PasarelaAuditoria](
    [idauditpas] [int] IDENTITY(1,1) NOT NULL,
    
    -- Tabla y registro afectado
    [tablaafectada] [varchar](100) NOT NULL,
    [idregistro] [int] NOT NULL,
    
    -- Acción
    [accion] [varchar](20) NOT NULL,                -- 'INSERT', 'UPDATE', 'DELETE'
    [camposcambiados] [nvarchar](max) NULL,         -- JSON con campos antes/después
    
    -- Usuario y contexto
    [idusu] [int] NULL,
    [ipaddress] [varchar](45) NULL,
    [useragent] [varchar](500) NULL,
    
    [fecaudit] [datetime] DEFAULT GETDATE(),
    
    CONSTRAINT [PK_PasarelaAuditoria] PRIMARY KEY CLUSTERED ([idauditpas] ASC)
) ON [PRIMARY]
GO

-- ============================================================================
-- 22. REPORTES DIARIOS CONSOLIDADOS
-- ============================================================================
CREATE TABLE [dbo].[PasarelaReporteDiario](
    [idreportediario] [int] IDENTITY(1,1) NOT NULL,
    [idpasarela] [int] NOT NULL,
    [idcajavirtual] [int] NULL,
    [fecreporte] [date] NOT NULL,
    
    -- Transacciones
    [canttransexitosas] [int] DEFAULT 0,
    [canttransfallidas] [int] DEFAULT 0,
    [canttranspendientes] [int] DEFAULT 0,
    
    -- Montos
    [montbrutototal] [decimal](14,2) DEFAULT 0,
    [montcomisiontotal] [decimal](14,2) DEFAULT 0,
    [montimpuestototal] [decimal](14,2) DEFAULT 0,
    [montneto total] [decimal](14,2) DEFAULT 0,
    
    -- Suscripciones
    [suscripcionesnuevas] [int] DEFAULT 0,
    [suscripcionescanceladas] [int] DEFAULT 0,
    [suscripcionesrenovadas] [int] DEFAULT 0,
    
    -- Reembolsos
    [cantreembolsos] [int] DEFAULT 0,
    [montreembolsos] [decimal](14,2) DEFAULT 0,
    
    [feccre] [datetime] DEFAULT GETDATE(),
    
    CONSTRAINT [PK_PasarelaReporteDiario] PRIMARY KEY CLUSTERED ([idreportediario] ASC),
    CONSTRAINT [FK_PasarelaReporteDiario_Pasarela] FOREIGN KEY ([idpasarela]) 
        REFERENCES [dbo].[PasarelaPago]([idpasarela]),
    CONSTRAINT [FK_PasarelaReporteDiario_CajaVirtual] FOREIGN KEY ([idcajavirtual]) 
        REFERENCES [dbo].[CajaVirtual]([idcajavirtual]),
    CONSTRAINT [UQ_PasarelaReporteDiario_FechaPas] UNIQUE ([idpasarela], [fecreporte])
) ON [PRIMARY]
GO












-- ============================================================================
-- INSERTAR DATOS INICIALES
-- ============================================================================

-- Estados comunes para Openpay
INSERT INTO [dbo].[PasarelaPago] ([nompasarela], [codpasarela], [ambiente]) VALUES
('Openpay', 'OPP', 'SANDBOX'),
('Niubiz', 'NIU', 'SANDBOX'),
('Stripe', 'STR', 'SANDBOX');
GO

-- Estados de Openpay
INSERT INTO [dbo].[PasarelaEstado] ([idpasarela], [codestadoext], [codestadoint], [desestado], [colorhex], [iconclass], [esfinal], [esexitoso]) VALUES
(1, 'in_progress', 'PENDIENTE', 'En Proceso', '#ffc107', 'fa-clock', 'N', 'N'),
(1, 'completed', 'COMPLETADO', 'Pago Exitoso', '#28a745', 'fa-check-circle', 'S', 'S'),
(1, 'charged', 'COBRADO', 'Cobrado', '#28a745', 'fa-check', 'S', 'S'),
(1, 'refunded', 'REEMBOLSADO', 'Reembolsado', '#17a2b8', 'fa-undo', 'S', 'N'),
(1, 'failed', 'FALLIDO', 'Pago Fallido', '#dc3545', 'fa-times-circle', 'S', 'N'),
(1, 'declined', 'RECHAZADO', 'Tarjeta Rechazada', '#dc3545', 'fa-ban', 'S', 'N'),
(1, 'cancelled', 'CANCELADO', 'Cancelado', '#6c757d', 'fa-times', 'S', 'N'),
(1, 'expired', 'EXPIRADO', 'Expirado', '#6c757d', 'fa-hourglass-end', 'S', 'N');
GO

-- Marcas de tarjeta
INSERT INTO [dbo].[PasarelaMarcaTarjeta] ([idpasarela], [codmarcaext], [desmarca], [colorfondo]) VALUES
(1, 'visa', 'Visa', '#1A1F71'),
(1, 'mastercard', 'Mastercard', '#EB001B'),
(1, 'american_express', 'American Express', '#006FCF'),
(1, 'diners_club', 'Diners Club', '#004080');
GO

-- Homologación de errores Openpay (Mensajes unificados para UX)
INSERT INTO [dbo].[PasarelaHomologacionError] 
([idpasarela], [coderrorext], [deserrorext], [coderrorint], [categoriaerror], [msgusuario], [msgusuariodetalle], [accionsugerida], [permitereintento], [severidad], [colorhex], [iconclass]) VALUES
-- Errores de Tarjeta
(1, '3001', 'La tarjeta fue declinada', 'FONDOS_INSUF', 'TARJETA', 'Tu tarjeta no tiene fondos suficientes', 'Intenta con otra tarjeta o verifica tu saldo disponible', 'CAMBIAR_TARJETA', 'S', 'BAJA', '#dc3545', 'fa-credit-card'),
(1, '3002', 'La tarjeta ha expirado', 'TARJETA_VENCIDA', 'TARJETA', 'Tu tarjeta ha expirado', 'Por favor utiliza una tarjeta vigente', 'CAMBIAR_TARJETA', 'S', 'BAJA', '#dc3545', 'fa-calendar-times'),
(1, '3003', 'La tarjeta no tiene fondos suficientes', 'FONDOS_INSUF', 'TARJETA', 'Fondos insuficientes en tu tarjeta', 'Verifica tu saldo o intenta con otra tarjeta', 'CAMBIAR_TARJETA', 'S', 'BAJA', '#dc3545', 'fa-wallet'),
(1, '3004', 'La tarjeta fue reportada como robada', 'TARJETA_ROBADA', 'FRAUDE', 'No se pudo procesar el pago', 'Contacta a tu banco para más información', 'CONTACTAR_BANCO', 'N', 'CRITICA', '#dc3545', 'fa-exclamation-triangle'),
(1, '3005', 'La tarjeta fue rechazada por el banco', 'BANCO_RECHAZA', 'BANCO', 'Tu banco rechazó la transacción', 'Contacta a tu banco o intenta con otra tarjeta', 'CONTACTAR_BANCO', 'S', 'MEDIA', '#dc3545', 'fa-university'),
(1, '3006', 'La tarjeta no permite este tipo de transacción', 'TIPO_NO_PERMITIDO', 'TARJETA', 'Tu tarjeta no permite este tipo de compra', 'Intenta con otra tarjeta o contacta a tu banco', 'CAMBIAR_TARJETA', 'S', 'MEDIA', '#dc3545', 'fa-ban'),
(1, '3007', 'El número de tarjeta es inválido', 'DATOS_INVALIDOS', 'USUARIO', 'El número de tarjeta es incorrecto', 'Verifica los datos de tu tarjeta', 'VERIFICAR_DATOS', 'S', 'BAJA', '#ffc107', 'fa-keyboard'),
(1, '3008', 'El CVV es inválido', 'CVV_INVALIDO', 'USUARIO', 'El código de seguridad es incorrecto', 'Verifica el código CVV de tu tarjeta (3 o 4 dígitos)', 'VERIFICAR_DATOS', 'S', 'BAJA', '#ffc107', 'fa-lock'),
(1, '3009', 'La fecha de expiración es inválida', 'FECHA_INVALIDA', 'USUARIO', 'La fecha de vencimiento es incorrecta', 'Verifica la fecha de vencimiento de tu tarjeta', 'VERIFICAR_DATOS', 'S', 'BAJA', '#ffc107', 'fa-calendar'),
(1, '3010', 'La tarjeta no tiene autorización para transacciones en línea', 'NO_ECOMMERCE', 'TARJETA', 'Tu tarjeta no está habilitada para compras en línea', 'Contacta a tu banco para habilitar compras por internet', 'CONTACTAR_BANCO', 'N', 'MEDIA', '#dc3545', 'fa-globe'),
-- Errores de Fraude/Seguridad
(1, '3011', 'Transacción denegada por sospecha de fraude', 'FRAUDE_DETECTADO', 'FRAUDE', 'Por tu seguridad, esta transacción fue bloqueada', 'Si crees que es un error, contacta a tu banco', 'CONTACTAR_BANCO', 'N', 'ALTA', '#dc3545', 'fa-shield-alt'),
(1, '3012', 'Se excedió el límite de intentos', 'LIMITE_INTENTOS', 'SISTEMA', 'Demasiados intentos fallidos', 'Espera unos minutos antes de intentar nuevamente', 'REINTENTAR', 'N', 'MEDIA', '#ffc107', 'fa-clock'),
-- Errores de Sistema
(1, '1000', 'Error interno de la pasarela', 'ERROR_PASARELA', 'SISTEMA', 'Ocurrió un error al procesar tu pago', 'Inténtalo nuevamente en unos momentos', 'REINTENTAR', 'S', 'ALTA', '#ffc107', 'fa-exclamation-circle'),
(1, '1001', 'Servicio no disponible', 'SERVICIO_NO_DISP', 'SISTEMA', 'El servicio de pagos no está disponible', 'Inténtalo más tarde', 'REINTENTAR', 'S', 'ALTA', '#ffc107', 'fa-server'),
(1, '1002', 'Tiempo de espera agotado', 'TIMEOUT', 'SISTEMA', 'La conexión tardó demasiado', 'Verifica tu conexión e inténtalo nuevamente', 'REINTENTAR', 'S', 'MEDIA', '#ffc107', 'fa-hourglass-end'),
-- Errores 3D Secure
(1, '3013', 'Fallo en autenticación 3D Secure', '3DS_FALLIDO', 'USUARIO', 'No se pudo verificar tu identidad', 'Intenta nuevamente y completa la verificación de tu banco', 'REINTENTAR', 'S', 'MEDIA', '#ffc107', 'fa-user-shield'),
(1, '3014', 'Autenticación 3D Secure cancelada', '3DS_CANCELADO', 'USUARIO', 'Cancelaste la verificación de seguridad', 'Completa la verificación para continuar con tu compra', 'REINTENTAR', 'S', 'BAJA', '#6c757d', 'fa-times-circle');
GO

-- Homologación de errores Niubiz (Ejemplo)
INSERT INTO [dbo].[PasarelaHomologacionError] 
([idpasarela], [coderrorext], [deserrorext], [coderrorint], [categoriaerror], [msgusuario], [msgusuariodetalle], [accionsugerida], [permitereintento], [severidad], [colorhex], [iconclass]) VALUES
(2, '101', 'Tarjeta inválida', 'DATOS_INVALIDOS', 'USUARIO', 'Los datos de tu tarjeta son incorrectos', 'Verifica el número, fecha y CVV', 'VERIFICAR_DATOS', 'S', 'BAJA', '#ffc107', 'fa-keyboard'),
(2, '102', 'Fondos insuficientes', 'FONDOS_INSUF', 'TARJETA', 'Tu tarjeta no tiene fondos suficientes', 'Intenta con otra tarjeta', 'CAMBIAR_TARJETA', 'S', 'BAJA', '#dc3545', 'fa-wallet'),
(2, '190', 'Denegada', 'BANCO_RECHAZA', 'BANCO', 'Tu banco rechazó la transacción', 'Contacta a tu banco para más información', 'CONTACTAR_BANCO', 'S', 'MEDIA', '#dc3545', 'fa-university'),
(2, '191', 'Tarjeta vencida', 'TARJETA_VENCIDA', 'TARJETA', 'Tu tarjeta ha expirado', 'Por favor utiliza una tarjeta vigente', 'CAMBIAR_TARJETA', 'S', 'BAJA', '#dc3545', 'fa-calendar-times');
GO

-- Configuración de reintentos
INSERT INTO [dbo].[PasarelaConfigReintento] ([idpasarela], [numintento], [diasespera], [enviarnotificacion], [tiponotificacion]) VALUES
(1, 1, 1, 'S', 'EMAIL'),
(1, 2, 3, 'S', 'EMAIL'),
(1, 3, 7, 'S', 'EMAIL,SMS');
GO

PRINT '============================================================'
PRINT 'TABLAS DE PASARELA DE PAGOS CREADAS EXITOSAMENTE'
PRINT '============================================================'
PRINT ''
PRINT 'RESUMEN DE TABLAS CREADAS (22 tablas):'
PRINT '1.  PasarelaPago              - Configuración de pasarelas'
PRINT '2.  PasarelaTipoTransaccion   - Catálogo tipos transacción'
PRINT '3.  PasarelaEstado            - Estados por pasarela'
PRINT '4.  PasarelaHomologacionError - Mapeo unificado de errores (UX)'
PRINT '5.  PasarelaMarcaTarjeta      - Marcas de tarjetas'
PRINT '6.  CajaVirtual               - Caja automática por día'
PRINT '7.  CajaCajaVirtual           - Relación caja física-virtual'
PRINT '8.  PasarelaPlan              - Planes de suscripción'
PRINT '9.  PasarelaCliente           - Clientes en pasarela'
PRINT '10. PasarelaTarjeta           - Tarjetas + BIN + Banco emisor'
PRINT '11. PasarelaSesion            - Sesiones de pago'
PRINT '12. PasarelaSesionHistorial   - Historial de sesiones'
PRINT '13. PasarelaSuscripcion       - Suscripciones activas'
PRINT '14. PasarelaTransaccion       - Transacciones (CIP/3DS/MultiMoneda)'
PRINT '15. PasarelaWebhookLog        - Logs de webhooks recibidos'
PRINT '16. PasarelaApiLog            - Logs de peticiones enviadas'
PRINT '17. PasarelaNotificacion      - Notificaciones enviadas'
PRINT '18. PasarelaReembolso         - Reembolsos'
PRINT '19. PasarelaDisputa           - Disputas/Contracargos'
PRINT '20. PasarelaConfigReintento   - Config reintentos'
PRINT '21. PasarelaAuditoria         - Auditoría general'
PRINT '22. PasarelaReporteDiario     - Reportes consolidados'
PRINT ''
PRINT 'NUEVA TABLA - PasarelaHomologacionError:'
PRINT '- Mapea errores de cada pasarela a mensajes amigables'
PRINT '- Campos: coderrorext, coderrorint, msgusuario, accionsugerida'
PRINT '- Incluye: categoria, severidad, permitereintento, notificaradmin'
PRINT '- Precargados: 17 errores Openpay + 4 errores Niubiz'
PRINT ''
PRINT 'CAMPOS EN PasarelaTransaccion:'
PRINT '- Pagos Offline: codigopago, urlrecibo, feclimitepago, codautorizacion'
PRINT '- Idempotencia/3DS: idempotencykey, requiere3ds, paso3ds, riesgoscore'
PRINT '- Multimoneda: monedaorigen, montoriginal, tipocambio'
PRINT ''
PRINT 'CAMPOS EN PasarelaTarjeta:'
PRINT '- BIN/Metadatos: bin, bancoemisor, paisemisor, categoriatarjeta, fingerprint'
PRINT ''
PRINT '============================================================'
GO
