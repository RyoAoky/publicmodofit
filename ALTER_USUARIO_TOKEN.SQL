/* ==========================================================================
   SCRIPT CONSOLIDADO: TOKEN DE SEGURIDAD DE USUARIO
   Archivo: ALTER_USUARIO_TOKEN.SQL
   Fecha: 04/01/2026
   Base de datos: SQL Server 2022
   
   DESCRIPCION:
   Este script implementa el sistema de tokens de seguridad por usuario para
   la aplicacion publica de ModoFit. El token actua como un identificador 
   secundario criptograficamente seguro (UUID v4) que se usa para validar 
   el acceso a datos sensibles del usuario, evitando que la manipulacion 
   de cookies o sesiones permita acceder a informacion de otros usuarios.
   
   CONTENIDO:
   - Parte 1: Agregar columna tokenusu a la tabla usuario
   - Parte 2: Migrar usuarios existentes con tokens unicos
   - Parte 3: Configurar columna como NOT NULL
   - Parte 4: Crear constraint UNIQUE para garantizar unicidad
   - Parte 5: Crear indice para busquedas eficientes
   - Parte 6: Crear DEFAULT constraint para nuevos registros
   - Parte 7: Verificacion final de la estructura
   
   REQUIREMENTS CUBIERTOS:
   - 6.1: Agregar columna tokenusu VARCHAR(36) a tabla usuario
   - 6.2: Crear constraint UNIQUE en columna tokenusu
   - 6.3: Crear DEFAULT constraint que genera UUID en INSERT
   - 6.4: Crear indice en tokenusu para busquedas eficientes
   - 2.1: Generar tokens unicos para usuarios existentes con NULL
   - 2.2: Registrar numero de usuarios actualizados durante migracion
   
   INSTRUCCIONES DE EJECUCION:
   1. Realizar backup de la base de datos antes de ejecutar
   2. Ejecutar este script en SQL Server Management Studio
   3. Verificar los mensajes de salida para confirmar exito
   4. El script es idempotente - puede ejecutarse multiples veces sin error
   
   NOTAS TECNICAS:
   - La funcion NEWID() de SQL Server genera UUIDs validos (v4)
   - El formato UUID es: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 caracteres)
   - El indice IX_usuario_tokenusu optimiza las consultas por token
   ========================================================================== */

SET NOCOUNT ON;
PRINT '==========================================================================';
PRINT 'INICIANDO: Implementacion de Token de Seguridad de Usuario';
PRINT 'Fecha de ejecucion: ' + CONVERT(VARCHAR, GETDATE(), 120);
PRINT '==========================================================================';
PRINT '';

-- ============================================================================
-- PARTE 1: AGREGAR COLUMNA tokenusu A LA TABLA usuario
-- Requirement: 6.1 - THE Sistema SHALL add a new column tokenusu of type 
--                    VARCHAR(36) to the usuario table
-- ============================================================================
PRINT '--- PARTE 1: Agregar columna tokenusu ---';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuario') AND name = 'tokenusu')
BEGIN
    ALTER TABLE [dbo].[usuario]
    ADD [tokenusu] [varchar](36) NULL;
    
    PRINT '[OK] Columna tokenusu agregada a la tabla usuario';
END
ELSE
BEGIN
    PRINT '[INFO] La columna tokenusu ya existe en la tabla usuario';
END
GO

-- ============================================================================
-- PARTE 2: MIGRAR USUARIOS EXISTENTES - Generar tokens unicos
-- Requirement: 2.1 - WHEN the migration script runs, THE Sistema SHALL 
--                    generate unique tokens for all existing users that 
--                    have NULL tokens
-- Requirement: 2.2 - THE Sistema SHALL log the number of users updated 
--                    during migration
-- ============================================================================
PRINT '';
PRINT '--- PARTE 2: Migrar usuarios existentes ---';

DECLARE @UsuariosSinToken INT;
DECLARE @UsuariosActualizados INT;
DECLARE @TotalUsuarios INT;

-- Contar estado inicial
SELECT @TotalUsuarios = COUNT(*) FROM [dbo].[usuario];
SELECT @UsuariosSinToken = COUNT(*) FROM [dbo].[usuario] WHERE [tokenusu] IS NULL;

PRINT 'Total de usuarios en la base de datos: ' + CAST(@TotalUsuarios AS VARCHAR(10));
PRINT 'Usuarios sin token asignado: ' + CAST(@UsuariosSinToken AS VARCHAR(10));

IF @UsuariosSinToken > 0
BEGIN
    BEGIN TRY
        -- Generar tokens unicos para usuarios sin token
        UPDATE [dbo].[usuario]
        SET [tokenusu] = CAST(NEWID() AS VARCHAR(36))
        WHERE [tokenusu] IS NULL;

        SET @UsuariosActualizados = @@ROWCOUNT;
        
        -- Requirement 2.2: Log del numero de usuarios actualizados
        PRINT '[OK] Usuarios actualizados con token: ' + CAST(@UsuariosActualizados AS VARCHAR(10));
    END TRY
    BEGIN CATCH
        PRINT '[ERROR] Error durante la migracion: ' + ERROR_MESSAGE();
        RAISERROR('La migracion de tokens fallo', 16, 1);
        RETURN;
    END CATCH
END
ELSE
BEGIN
    PRINT '[INFO] No hay usuarios que requieran migracion';
END
GO

-- ============================================================================
-- PARTE 3: HACER LA COLUMNA NOT NULL despues de la migracion
-- Requirement: 1.4 - THE Token_Usuario SHALL NOT be null for any user
-- ============================================================================
PRINT '';
PRINT '--- PARTE 3: Configurar columna como NOT NULL ---';

-- Verificar que no hay valores NULL antes de cambiar a NOT NULL
DECLARE @NullCount INT;
SELECT @NullCount = COUNT(*) FROM [dbo].[usuario] WHERE [tokenusu] IS NULL;

IF @NullCount = 0
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('usuario') AND name = 'tokenusu' AND is_nullable = 1)
    BEGIN
        ALTER TABLE [dbo].[usuario]
        ALTER COLUMN [tokenusu] [varchar](36) NOT NULL;
        
        PRINT '[OK] Columna tokenusu configurada como NOT NULL';
    END
    ELSE
    BEGIN
        PRINT '[INFO] La columna tokenusu ya esta configurada como NOT NULL';
    END
END
ELSE
BEGIN
    PRINT '[ADVERTENCIA] Hay ' + CAST(@NullCount AS VARCHAR(10)) + ' usuarios con token NULL. No se puede configurar NOT NULL.';
END
GO

-- ============================================================================
-- PARTE 4: CREAR CONSTRAINT UNIQUE para garantizar unicidad
-- Requirement: 6.2 - THE Sistema SHALL create a UNIQUE constraint on the 
--                    tokenusu column
-- Requirement: 1.3 - THE Token_Usuario SHALL be unique across all users
-- ============================================================================
PRINT '';
PRINT '--- PARTE 4: Crear constraint UNIQUE ---';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_usuario_tokenusu' AND object_id = OBJECT_ID('usuario'))
BEGIN
    ALTER TABLE [dbo].[usuario]
    ADD CONSTRAINT [UQ_usuario_tokenusu] UNIQUE ([tokenusu]);
    
    PRINT '[OK] Constraint UNIQUE UQ_usuario_tokenusu creado';
END
ELSE
BEGIN
    PRINT '[INFO] El constraint UQ_usuario_tokenusu ya existe';
END
GO

-- ============================================================================
-- PARTE 5: CREAR INDICE para busquedas eficientes por token
-- Requirement: 6.4 - THE Sistema SHALL create an index on tokenusu for 
--                    efficient lookups
-- ============================================================================
PRINT '';
PRINT '--- PARTE 5: Crear indice para busquedas eficientes ---';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_usuario_tokenusu' AND object_id = OBJECT_ID('usuario'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_usuario_tokenusu] 
    ON [dbo].[usuario]([tokenusu]);
    
    PRINT '[OK] Indice IX_usuario_tokenusu creado';
END
ELSE
BEGIN
    PRINT '[INFO] El indice IX_usuario_tokenusu ya existe';
END
GO

-- ============================================================================
-- PARTE 6: CREAR DEFAULT CONSTRAINT para nuevos registros
-- Requirement: 6.3 - THE Sistema SHALL create a DEFAULT constraint that 
--                    generates a new UUID for tokenusu on INSERT
-- Requirement: 1.1 - WHEN a new user record is inserted, THE Sistema SHALL 
--                    automatically generate a unique cryptographic token
-- ============================================================================
PRINT '';
PRINT '--- PARTE 6: Crear DEFAULT constraint para nuevos registros ---';

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_usuario_tokenusu')
BEGIN
    ALTER TABLE [dbo].[usuario]
    ADD CONSTRAINT [DF_usuario_tokenusu] DEFAULT (CAST(NEWID() AS VARCHAR(36))) FOR [tokenusu];
    
    PRINT '[OK] Default constraint DF_usuario_tokenusu creado';
END
ELSE
BEGIN
    PRINT '[INFO] El default constraint DF_usuario_tokenusu ya existe';
END
GO

-- ============================================================================
-- PARTE 7: VERIFICACION FINAL DE LA ESTRUCTURA
-- ============================================================================
PRINT '';
PRINT '==========================================================================';
PRINT 'VERIFICACION FINAL DE LA ESTRUCTURA';
PRINT '==========================================================================';

-- Verificar estructura de la columna
PRINT '';
PRINT '--- Estructura de la columna tokenusu ---';
SELECT 
    c.name AS 'Columna',
    t.name AS 'Tipo',
    c.max_length AS 'Longitud',
    CASE WHEN c.is_nullable = 1 THEN 'SI' ELSE 'NO' END AS 'Permite NULL',
    ISNULL(dc.name, 'N/A') AS 'Default Constraint'
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
WHERE c.object_id = OBJECT_ID('usuario') AND c.name = 'tokenusu';

-- Verificar indices y constraints
PRINT '';
PRINT '--- Indices y Constraints en tokenusu ---';
SELECT 
    i.name AS 'Nombre',
    i.type_desc AS 'Tipo',
    CASE WHEN i.is_unique = 1 THEN 'SI' ELSE 'NO' END AS 'Es Unico'
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('usuario') 
AND (i.name LIKE '%tokenusu%');

-- Verificar que no hay tokens duplicados
PRINT '';
PRINT '--- Verificacion de unicidad de tokens ---';
DECLARE @DuplicadosCount INT;
SELECT @DuplicadosCount = COUNT(*)
FROM (
    SELECT [tokenusu]
    FROM [dbo].[usuario]
    WHERE [tokenusu] IS NOT NULL
    GROUP BY [tokenusu]
    HAVING COUNT(*) > 1
) AS duplicados;

IF @DuplicadosCount > 0
BEGIN
    PRINT '[ADVERTENCIA] Se encontraron ' + CAST(@DuplicadosCount AS VARCHAR(10)) + ' tokens duplicados';
END
ELSE
BEGIN
    PRINT '[OK] No hay tokens duplicados - Unicidad verificada';
END

-- Verificar que no hay tokens NULL
DECLARE @NullTokens INT;
SELECT @NullTokens = COUNT(*) FROM [dbo].[usuario] WHERE [tokenusu] IS NULL;

IF @NullTokens > 0
BEGIN
    PRINT '[ADVERTENCIA] Hay ' + CAST(@NullTokens AS VARCHAR(10)) + ' usuarios sin token';
END
ELSE
BEGIN
    PRINT '[OK] Todos los usuarios tienen token asignado';
END

-- Resumen final
PRINT '';
PRINT '==========================================================================';
PRINT 'IMPLEMENTACION COMPLETADA';
PRINT '==========================================================================';
PRINT '';
PRINT 'Requirements implementados:';
PRINT '  [6.1] Columna tokenusu VARCHAR(36) agregada';
PRINT '  [6.2] Constraint UNIQUE UQ_usuario_tokenusu creado';
PRINT '  [6.3] Default constraint DF_usuario_tokenusu creado';
PRINT '  [6.4] Indice IX_usuario_tokenusu creado';
PRINT '  [2.1] Usuarios existentes migrados con tokens unicos';
PRINT '  [2.2] Numero de usuarios actualizados registrado';
PRINT '';
PRINT 'El script es idempotente y puede ejecutarse multiples veces.';
PRINT '==========================================================================';
GO
