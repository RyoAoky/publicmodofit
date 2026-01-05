/* ==========================================================================
   SCRIPT DE MIGRACIÓN - TOKEN DE SEGURIDAD DE USUARIO
   Fecha: 04/01/2026
   
   Este script migra los usuarios existentes que no tienen token asignado.
   Debe ejecutarse DESPUÉS de ALTER_USUARIO_TOKEN.SQL si la columna ya existe
   pero hay usuarios sin token.
   
   Requirements: 2.1, 2.2
   ========================================================================== */

SET NOCOUNT ON;

PRINT '=== Iniciando migración de tokens de usuario ===';
PRINT 'Fecha de ejecución: ' + CONVERT(VARCHAR, GETDATE(), 120);

-- ============================================================================
-- VERIFICAR QUE LA COLUMNA EXISTE
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuario') AND name = 'tokenusu')
BEGIN
    RAISERROR('ERROR: La columna tokenusu no existe. Ejecute primero ALTER_USUARIO_TOKEN.SQL', 16, 1);
    RETURN;
END

-- ============================================================================
-- CONTAR USUARIOS SIN TOKEN ANTES DE LA MIGRACIÓN
-- ============================================================================
DECLARE @UsuariosSinToken INT;
DECLARE @TotalUsuarios INT;
DECLARE @UsuariosActualizados INT;

SELECT @TotalUsuarios = COUNT(*) FROM [dbo].[usuario];
SELECT @UsuariosSinToken = COUNT(*) FROM [dbo].[usuario] WHERE [tokenusu] IS NULL OR [tokenusu] = '';

PRINT 'Total de usuarios en la base de datos: ' + CAST(@TotalUsuarios AS VARCHAR(10));
PRINT 'Usuarios sin token asignado: ' + CAST(@UsuariosSinToken AS VARCHAR(10));

-- ============================================================================
-- MIGRACIÓN: Generar tokens únicos para usuarios sin token
-- Requirements: 2.1
-- ============================================================================
IF @UsuariosSinToken > 0
BEGIN
    PRINT 'Iniciando generación de tokens...';
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Actualizar usuarios con token NULL
        UPDATE [dbo].[usuario]
        SET [tokenusu] = CAST(NEWID() AS VARCHAR(36))
        WHERE [tokenusu] IS NULL;
        
        SET @UsuariosActualizados = @@ROWCOUNT;
        
        -- Actualizar usuarios con token vacío
        UPDATE [dbo].[usuario]
        SET [tokenusu] = CAST(NEWID() AS VARCHAR(36))
        WHERE [tokenusu] = '';
        
        SET @UsuariosActualizados = @UsuariosActualizados + @@ROWCOUNT;
        
        COMMIT TRANSACTION;
        
        -- Requirements: 2.2 - Log del número de usuarios actualizados
        PRINT 'Migración completada exitosamente';
        PRINT 'Usuarios actualizados con nuevo token: ' + CAST(@UsuariosActualizados AS VARCHAR(10));
        
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        PRINT 'ERROR durante la migración: ' + ERROR_MESSAGE();
        RAISERROR('La migración falló. Se ha revertido la transacción.', 16, 1);
        RETURN;
    END CATCH
END
ELSE
BEGIN
    PRINT 'No hay usuarios que requieran migración. Todos tienen token asignado.';
END

-- ============================================================================
-- VERIFICACIÓN: Asegurar que no hay duplicados
-- Requirements: 2.2
-- ============================================================================
DECLARE @Duplicados INT;

SELECT @Duplicados = COUNT(*)
FROM (
    SELECT [tokenusu], COUNT(*) as cnt
    FROM [dbo].[usuario]
    WHERE [tokenusu] IS NOT NULL
    GROUP BY [tokenusu]
    HAVING COUNT(*) > 1
) AS dup;

IF @Duplicados > 0
BEGIN
    PRINT 'ADVERTENCIA: Se detectaron ' + CAST(@Duplicados AS VARCHAR(10)) + ' tokens duplicados';
    
    -- Mostrar los duplicados para revisión
    SELECT [tokenusu], COUNT(*) as 'Cantidad'
    FROM [dbo].[usuario]
    WHERE [tokenusu] IS NOT NULL
    GROUP BY [tokenusu]
    HAVING COUNT(*) > 1;
END
ELSE
BEGIN
    PRINT 'Verificación de unicidad: OK - No hay tokens duplicados';
END

-- ============================================================================
-- VERIFICACIÓN FINAL: Contar usuarios sin token después de migración
-- ============================================================================
DECLARE @UsuariosSinTokenFinal INT;

SELECT @UsuariosSinTokenFinal = COUNT(*) 
FROM [dbo].[usuario] 
WHERE [tokenusu] IS NULL OR [tokenusu] = '';

IF @UsuariosSinTokenFinal > 0
BEGIN
    PRINT 'ADVERTENCIA: Aún hay ' + CAST(@UsuariosSinTokenFinal AS VARCHAR(10)) + ' usuarios sin token';
END
ELSE
BEGIN
    PRINT 'Verificación final: OK - Todos los usuarios tienen token asignado';
END

-- ============================================================================
-- RESUMEN DE LA MIGRACIÓN
-- ============================================================================
PRINT '';
PRINT '=== RESUMEN DE MIGRACIÓN ===';
PRINT 'Total usuarios: ' + CAST(@TotalUsuarios AS VARCHAR(10));
PRINT 'Usuarios migrados: ' + CAST(ISNULL(@UsuariosActualizados, 0) AS VARCHAR(10));
PRINT 'Usuarios sin token (final): ' + CAST(@UsuariosSinTokenFinal AS VARCHAR(10));
PRINT 'Tokens duplicados: ' + CAST(@Duplicados AS VARCHAR(10));
PRINT '=== Migración finalizada ===';
GO
