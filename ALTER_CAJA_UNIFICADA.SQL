-- ============================================================================
-- SCRIPT: UNIFICACIÓN DE CAJA + EXTENSIÓN PARA PASARELA
-- Fecha: 02/01/2026
-- 
-- OBJETIVO: Una sola tabla Caja con columna tipocaja, y tabla de extensión
--           CajaDetallePasarela para datos específicos de comisiones
--
-- ARQUITECTURA:
-- ┌─────────────────────────────────────┐
-- │              CAJA                   │  ← Tabla principal (unificada)
-- │  tipocaja: 'F'=Física, 'V'=Virtual  │
-- │  origenapertura: 'M'=Manual, 'A'=Auto│
-- └──────────────┬──────────────────────┘
--                │ 1:1 (solo para tipocaja='V')
--                ▼
-- ┌─────────────────────────────────────┐
-- │       CajaDetallePasarela           │  ← Extensión con datos de comisiones
-- │  montbruto, comisionpasarela        │
-- │  comisioniva, montneto              │
-- │  canttransacciones, etc.            │
-- └─────────────────────────────────────┘
-- ============================================================================

USE [ModoFit]
GO

-- ============================================================================
-- PASO 1: AGREGAR COLUMNAS A TABLA CAJA EXISTENTE
-- ============================================================================

-- Columna tipocaja: F=Física (intranet), V=Virtual (web/pasarela)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Caja') AND name = 'tipocaja')
BEGIN
    ALTER TABLE [dbo].[Caja] ADD [tipocaja] [char](1) DEFAULT 'F' NOT NULL;
    PRINT '✓ Columna tipocaja agregada a Caja (F=Física, V=Virtual)';
END
GO

-- Columna origenapertura: M=Manual (usuario), A=Automática (sistema)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Caja') AND name = 'origenapertura')
BEGIN
    ALTER TABLE [dbo].[Caja] ADD [origenapertura] [char](1) DEFAULT 'M' NOT NULL;
    PRINT '✓ Columna origenapertura agregada a Caja (M=Manual, A=Automática)';
END
GO

-- Columna estcaja: A=Abierta, C=Cerrada
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Caja') AND name = 'estcaja')
BEGIN
    ALTER TABLE [dbo].[Caja] ADD [estcaja] [char](1) DEFAULT 'A' NOT NULL;
    PRINT '✓ Columna estcaja agregada a Caja (A=Abierta, C=Cerrada)';
END
GO

-- Columna fecoperacion: Fecha de operación (útil para virtuales - 1 por día)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Caja') AND name = 'fecoperacion')
BEGIN
    ALTER TABLE [dbo].[Caja] ADD [fecoperacion] [date] NULL;
    PRINT '✓ Columna fecoperacion agregada a Caja';
END
GO

-- Columna idpasarela: Solo para cajas virtuales
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Caja') AND name = 'idpasarela')
BEGIN
    ALTER TABLE [dbo].[Caja] ADD [idpasarela] [int] NULL;
    PRINT '✓ Columna idpasarela agregada a Caja';
END
GO

-- ============================================================================
-- PASO 2: CREAR TABLA DE EXTENSIÓN PARA DETALLES DE PASARELA
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CajaDetallePasarela')
BEGIN
    CREATE TABLE [dbo].[CajaDetallePasarela](
        [idcajadetpas] [int] IDENTITY(1,1) NOT NULL,
        [idcaja] [int] NOT NULL,                        -- FK a Caja (tipocaja='V')
        [idpasarela] [int] NOT NULL,                    -- FK a PasarelaPago
        
        -- Contadores de transacciones
        [canttransacciones] [int] DEFAULT 0,
        [cantaprobadas] [int] DEFAULT 0,
        [cantrechazadas] [int] DEFAULT 0,
        [cantpendientes] [int] DEFAULT 0,
        [cantreembolsos] [int] DEFAULT 0,
        
        -- Montos brutos (lo que paga el cliente)
        [montbruto] [decimal](12,2) DEFAULT 0.00,
        
        -- Comisiones de la pasarela
        [comisionporc] [decimal](6,4) DEFAULT 0.00,     -- % aplicado (ej: 3.99)
        [comisionfija] [decimal](12,2) DEFAULT 0.00,    -- Monto fijo por transacción
        [montcomision] [decimal](12,2) DEFAULT 0.00,    -- Total comisiones
        [montiva] [decimal](12,2) DEFAULT 0.00,         -- IGV sobre comisiones (18%)
        
        -- Monto neto (lo que recibimos)
        [montneto] [decimal](12,2) DEFAULT 0.00,
        
        -- Reembolsos del día
        [montreembolsos] [decimal](12,2) DEFAULT 0.00,
        
        -- Conciliación con banco
        [fecconciliacion] [datetime] NULL,
        [montconciliado] [decimal](12,2) NULL,
        [diferenciaconcil] [decimal](12,2) NULL,
        [estadoconcil] [char](1) DEFAULT 'P',           -- P=Pendiente, C=Conciliado, D=Discrepancia
        [obsconciliacion] [varchar](500) NULL,
        
        -- Auditoría
        [feccre] [datetime] DEFAULT GETDATE(),
        [fecmov] [datetime] NULL,
        
        CONSTRAINT [PK_CajaDetallePasarela] PRIMARY KEY CLUSTERED ([idcajadetpas] ASC),
        CONSTRAINT [FK_CajaDetallePasarela_Caja] FOREIGN KEY ([idcaja]) 
            REFERENCES [dbo].[Caja]([idcaja]),
        CONSTRAINT [UQ_CajaDetallePasarela_Caja] UNIQUE ([idcaja])
    ) ON [PRIMARY];
    
    PRINT '✓ Tabla CajaDetallePasarela creada';
END
GO

-- ============================================================================
-- PASO 3: ÍNDICES PARA OPTIMIZACIÓN
-- ============================================================================

-- Índice para buscar cajas por tipo y estado
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Caja_TipoEstado')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Caja_TipoEstado] 
    ON [dbo].[Caja] ([tipocaja], [estcaja])
    INCLUDE ([fecoperacion], [apertura], [cierre]);
    PRINT '✓ Índice IX_Caja_TipoEstado creado';
END
GO

-- Índice para buscar cajas virtuales por fecha
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Caja_FecOperacion')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Caja_FecOperacion] 
    ON [dbo].[Caja] ([fecoperacion])
    WHERE [tipocaja] = 'V';
    PRINT '✓ Índice IX_Caja_FecOperacion creado';
END
GO

-- Índice para conciliación pendiente
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CajaDetallePasarela_Conciliacion')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_CajaDetallePasarela_Conciliacion] 
    ON [dbo].[CajaDetallePasarela] ([estadoconcil])
    WHERE [estadoconcil] != 'C';
    PRINT '✓ Índice IX_CajaDetallePasarela_Conciliacion creado';
END
GO

-- ============================================================================
-- PASO 4: MODIFICAR TABLA VENTA PARA USAR CAJA UNIFICADA
-- ============================================================================

-- La columna idcaja ya existe, solo agregamos origenventa
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Venta') AND name = 'origenventa')
BEGIN
    ALTER TABLE [dbo].[Venta] ADD [origenventa] [char](1) DEFAULT 'F' NOT NULL;
    PRINT '✓ Columna origenventa agregada a Venta (F=Física, V=Virtual)';
END
GO

-- Columna para vincular con transacción de pasarela
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Venta') AND name = 'idtranspas')
BEGIN
    ALTER TABLE [dbo].[Venta] ADD [idtranspas] [int] NULL;
    PRINT '✓ Columna idtranspas agregada a Venta';
END
GO

-- ============================================================================
-- PASO 5: MODIFICAR TABLA MEMBRESIA
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Membresia') AND name = 'idsuscpas')
BEGIN
    ALTER TABLE [dbo].[Membresia] ADD [idsuscpas] [int] NULL;
    PRINT '✓ Columna idsuscpas agregada a Membresia';
END
GO

-- ============================================================================
-- PASO 6: MODIFICAR PASARELATRANSACCION - Cambiar idcajavirtual por idcaja
-- ============================================================================

-- Agregar columna idcaja (si no existe)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PasarelaTransaccion') AND name = 'idcaja')
BEGIN
    ALTER TABLE [dbo].[PasarelaTransaccion] ADD [idcaja] [int] NULL;
    PRINT '✓ Columna idcaja agregada a PasarelaTransaccion';
END
GO

-- Agregar columna idven
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PasarelaTransaccion') AND name = 'idven')
BEGIN
    ALTER TABLE [dbo].[PasarelaTransaccion] ADD [idven] [int] NULL;
    PRINT '✓ Columna idven agregada a PasarelaTransaccion';
END
GO

-- ============================================================================
-- PASO 7: MODIFICAR PASARELASUSCRIPCION
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PasarelaSuscripcion') AND name = 'idmem')
BEGIN
    ALTER TABLE [dbo].[PasarelaSuscripcion] ADD [idmem] [int] NULL;
    PRINT '✓ Columna idmem agregada a PasarelaSuscripcion';
END
GO

-- ============================================================================
-- PASO 8: PROCEDIMIENTO PARA OBTENER/CREAR CAJA VIRTUAL DEL DÍA
-- ============================================================================

IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'sp_ObtenerCajaVirtualDia')
    DROP PROCEDURE [dbo].[sp_ObtenerCajaVirtualDia];
GO

CREATE PROCEDURE [dbo].[sp_ObtenerCajaVirtualDia]
    @idpasarela INT = 1,
    @idcaja INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @fechaHoy DATE = CONVERT(DATE, GETDATE());
    
    -- Buscar caja virtual del día
    SELECT @idcaja = idcaja
    FROM [dbo].[Caja]
    WHERE tipocaja = 'V'
      AND fecoperacion = @fechaHoy
      AND idpasarela = @idpasarela
      AND estcaja = 'A';
    
    -- Si no existe, crearla automáticamente
    IF @idcaja IS NULL
    BEGIN
        -- Cerrar cajas virtuales anteriores que quedaron abiertas
        UPDATE [dbo].[Caja]
        SET estcaja = 'C',
            cierre = GETDATE()
        WHERE tipocaja = 'V'
          AND idpasarela = @idpasarela
          AND estcaja = 'A'
          AND fecoperacion < @fechaHoy;
        
        -- Crear nueva caja virtual
        INSERT INTO [dbo].[Caja] (
            apertura, montinicaja, montfincaja, idusu,
            tipocaja, origenapertura, estcaja, fecoperacion, idpasarela
        ) VALUES (
            GETDATE(), 0, 0, 0,
            'V', 'A', 'A', @fechaHoy, @idpasarela
        );
        
        SET @idcaja = SCOPE_IDENTITY();
        
        -- Crear registro de extensión para detalles de pasarela
        INSERT INTO [dbo].[CajaDetallePasarela] (
            idcaja, idpasarela, canttransacciones, montbruto, montneto
        ) VALUES (
            @idcaja, @idpasarela, 0, 0, 0
        );
        
        PRINT 'Caja virtual creada automáticamente: ' + CAST(@idcaja AS VARCHAR);
    END
END
GO

PRINT '✓ Procedimiento sp_ObtenerCajaVirtualDia creado';
GO

-- ============================================================================
-- PASO 9: PROCEDIMIENTO PARA ACTUALIZAR TOTALES DE CAJA VIRTUAL
-- ============================================================================

IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'sp_ActualizarCajaVirtual')
    DROP PROCEDURE [dbo].[sp_ActualizarCajaVirtual];
GO

CREATE PROCEDURE [dbo].[sp_ActualizarCajaVirtual]
    @idcaja INT,
    @montotransaccion DECIMAL(12,2),
    @esAprobada BIT = 1,
    @comisionporc DECIMAL(6,4) = 3.99,
    @comisionfija DECIMAL(12,2) = 0
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @comision DECIMAL(12,2);
    DECLARE @iva DECIMAL(12,2);
    DECLARE @neto DECIMAL(12,2);
    
    -- Calcular comisión
    SET @comision = (@montotransaccion * @comisionporc / 100) + @comisionfija;
    SET @iva = @comision * 0.18; -- IGV 18%
    SET @neto = @montotransaccion - @comision - @iva;
    
    -- Actualizar caja principal
    UPDATE [dbo].[Caja]
    SET montfincaja = ISNULL(montfincaja, 0) + @montotransaccion
    WHERE idcaja = @idcaja;
    
    -- Actualizar extensión de pasarela
    IF @esAprobada = 1
    BEGIN
        UPDATE [dbo].[CajaDetallePasarela]
        SET canttransacciones = canttransacciones + 1,
            cantaprobadas = cantaprobadas + 1,
            montbruto = montbruto + @montotransaccion,
            montcomision = montcomision + @comision,
            montiva = montiva + @iva,
            montneto = montneto + @neto,
            comisionporc = @comisionporc,
            comisionfija = @comisionfija,
            fecmov = GETDATE()
        WHERE idcaja = @idcaja;
    END
    ELSE
    BEGIN
        UPDATE [dbo].[CajaDetallePasarela]
        SET canttransacciones = canttransacciones + 1,
            cantrechazadas = cantrechazadas + 1,
            fecmov = GETDATE()
        WHERE idcaja = @idcaja;
    END
END
GO

PRINT '✓ Procedimiento sp_ActualizarCajaVirtual creado';
GO

-- ============================================================================
-- PASO 10: VISTA CONSOLIDADA DE CAJAS
-- ============================================================================

IF EXISTS (SELECT 1 FROM sys.views WHERE name = 'vw_CajaConsolidada')
    DROP VIEW [dbo].[vw_CajaConsolidada];
GO

CREATE VIEW [dbo].[vw_CajaConsolidada]
AS
SELECT 
    c.idcaja,
    c.tipocaja,
    CASE c.tipocaja WHEN 'F' THEN 'Física' WHEN 'V' THEN 'Virtual' END AS tipocaja_desc,
    c.origenapertura,
    CASE c.origenapertura WHEN 'M' THEN 'Manual' WHEN 'A' THEN 'Automática' END AS origen_desc,
    c.estcaja,
    CASE c.estcaja WHEN 'A' THEN 'Abierta' WHEN 'C' THEN 'Cerrada' END AS estado_desc,
    c.apertura,
    c.cierre,
    c.fecoperacion,
    c.montinicaja,
    c.montfincaja,
    c.idusu,
    
    -- Datos de pasarela (solo para tipocaja='V')
    cdp.canttransacciones,
    cdp.cantaprobadas,
    cdp.cantrechazadas,
    cdp.montbruto,
    cdp.montcomision,
    cdp.montiva,
    cdp.montneto,
    cdp.estadoconcil,
    cdp.fecconciliacion
    
FROM [dbo].[Caja] c
LEFT JOIN [dbo].[CajaDetallePasarela] cdp ON c.idcaja = cdp.idcaja
GO

PRINT '✓ Vista vw_CajaConsolidada creada';
GO

-- ============================================================================
-- RESUMEN FINAL
-- ============================================================================

PRINT '';
PRINT '========================================';
PRINT 'RESUMEN DE CAMBIOS APLICADOS';
PRINT '========================================';
PRINT '';
PRINT 'TABLA CAJA - Nuevas columnas:';
PRINT '  - tipocaja (F=Física, V=Virtual)';
PRINT '  - origenapertura (M=Manual, A=Automática)';
PRINT '  - estcaja (A=Abierta, C=Cerrada)';
PRINT '  - fecoperacion (fecha para virtuales)';
PRINT '  - idpasarela (FK a PasarelaPago)';
PRINT '';
PRINT 'NUEVA TABLA CajaDetallePasarela:';
PRINT '  - Extensión 1:1 para cajas virtuales';
PRINT '  - Contadores de transacciones';
PRINT '  - Cálculo de comisiones e IVA';
PRINT '  - Control de conciliación bancaria';
PRINT '';
PRINT 'PROCEDIMIENTOS ALMACENADOS:';
PRINT '  - sp_ObtenerCajaVirtualDia';
PRINT '  - sp_ActualizarCajaVirtual';
PRINT '';
PRINT 'VISTAS:';
PRINT '  - vw_CajaConsolidada';
PRINT '';
PRINT '========================================';
PRINT 'NOTA: La tabla CajaVirtual ya NO se necesita';
PRINT 'Elimínala manualmente si ya existe';
PRINT '========================================';
GO
