
/* ==========================================================================
   ALTERACIONES PARA TRAZABILIDAD CON PasarelaApiLog
   Fecha: 02/01/2026
   
   Se agrega columna idapilog a las tablas que interactúan con la API
   para tener trazabilidad completa de cada operación.
   ========================================================================== */

-- ============================================================================
-- 1. AGREGAR idapilog A PasarelaCliente
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PasarelaCliente') AND name = 'idapilog')
BEGIN
    ALTER TABLE [dbo].[PasarelaCliente]
    ADD [idapilog] [int] NULL;
    
    ALTER TABLE [dbo].[PasarelaCliente]
    ADD CONSTRAINT [FK_PasarelaCliente_ApiLog] FOREIGN KEY ([idapilog])
        REFERENCES [dbo].[PasarelaApiLog]([idapilog]);
    
    PRINT 'Columna idapilog agregada a PasarelaCliente';
END
GO

-- ============================================================================
-- 2. AGREGAR idapilog A PasarelaTarjeta
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PasarelaTarjeta') AND name = 'idapilog')
BEGIN
    ALTER TABLE [dbo].[PasarelaTarjeta]
    ADD [idapilog] [int] NULL;
    
    ALTER TABLE [dbo].[PasarelaTarjeta]
    ADD CONSTRAINT [FK_PasarelaTarjeta_ApiLog] FOREIGN KEY ([idapilog])
        REFERENCES [dbo].[PasarelaApiLog]([idapilog]);
    
    PRINT 'Columna idapilog agregada a PasarelaTarjeta';
END
GO

-- ============================================================================
-- 3. AGREGAR idapilog A PasarelaSuscripcion
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PasarelaSuscripcion') AND name = 'idapilog')
BEGIN
    ALTER TABLE [dbo].[PasarelaSuscripcion]
    ADD [idapilog] [int] NULL;
    
    ALTER TABLE [dbo].[PasarelaSuscripcion]
    ADD CONSTRAINT [FK_PasarelaSuscripcion_ApiLog] FOREIGN KEY ([idapilog])
        REFERENCES [dbo].[PasarelaApiLog]([idapilog]);
    
    PRINT 'Columna idapilog agregada a PasarelaSuscripcion';
END
GO

-- ============================================================================
-- 4. AGREGAR idapilog A PasarelaTransaccion
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PasarelaTransaccion') AND name = 'idapilog')
BEGIN
    ALTER TABLE [dbo].[PasarelaTransaccion]
    ADD [idapilog] [int] NULL;
    
    ALTER TABLE [dbo].[PasarelaTransaccion]
    ADD CONSTRAINT [FK_PasarelaTransaccion_ApiLog] FOREIGN KEY ([idapilog])
        REFERENCES [dbo].[PasarelaApiLog]([idapilog]);
    
    PRINT 'Columna idapilog agregada a PasarelaTransaccion';
END
GO

-- ============================================================================
-- 5. AGREGAR idapilog A PasarelaSesion
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PasarelaSesion') AND name = 'idapilog')
BEGIN
    ALTER TABLE [dbo].[PasarelaSesion]
    ADD [idapilog] [int] NULL;
    
    ALTER TABLE [dbo].[PasarelaSesion]
    ADD CONSTRAINT [FK_PasarelaSesion_ApiLog] FOREIGN KEY ([idapilog])
        REFERENCES [dbo].[PasarelaApiLog]([idapilog]);
    
    PRINT 'Columna idapilog agregada a PasarelaSesion';
END
GO

-- ============================================================================
-- 6. AGREGAR idsesionpas A PasarelaTransaccion (si no existe)
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PasarelaTransaccion') AND name = 'idsesionpas')
BEGIN
    ALTER TABLE [dbo].[PasarelaTransaccion]
    ADD [idsesionpas] [int] NULL;
    
    PRINT 'Columna idsesionpas agregada a PasarelaTransaccion';
END
GO

-- ============================================================================
-- ÍNDICES PARA MEJORAR BÚSQUEDAS POR idapilog
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PasarelaCliente_ApiLog')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PasarelaCliente_ApiLog] 
    ON [dbo].[PasarelaCliente]([idapilog])
    WHERE [idapilog] IS NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PasarelaTarjeta_ApiLog')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PasarelaTarjeta_ApiLog] 
    ON [dbo].[PasarelaTarjeta]([idapilog])
    WHERE [idapilog] IS NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PasarelaSuscripcion_ApiLog')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PasarelaSuscripcion_ApiLog] 
    ON [dbo].[PasarelaSuscripcion]([idapilog])
    WHERE [idapilog] IS NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PasarelaTransaccion_ApiLog')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PasarelaTransaccion_ApiLog] 
    ON [dbo].[PasarelaTransaccion]([idapilog])
    WHERE [idapilog] IS NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PasarelaSesion_ApiLog')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PasarelaSesion_ApiLog] 
    ON [dbo].[PasarelaSesion]([idapilog])
    WHERE [idapilog] IS NOT NULL;
END
GO

PRINT '=== Alteraciones completadas exitosamente ===';
GO
