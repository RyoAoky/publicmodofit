-- ============================================================================
-- INSERTAR CONFIGURACIÓN DE OPENPAY EN PasarelaPago
-- Ejecutar este script para habilitar el registro en PasarelaApiLog
-- ============================================================================

-- Verificar si ya existe
IF NOT EXISTS (SELECT 1 FROM PasarelaPago WHERE codpasarela = 'OPP')
BEGIN
    INSERT INTO PasarelaPago (
        nompasarela,
        codpasarela,
        ambiente,
        merchantid,
        publickey,
        privatekey,
        apikey,
        comisionporc,
        comisionfija,
        impuestoporc,
        moneda,
        urlapibase,
        estado,
        feccre
    )
    VALUES (
        'OpenPay Peru',                              -- nompasarela
        'OPP',                                       -- codpasarela
        'SANDBOX',                                   -- ambiente (cambiar a 'PRODUCTION' en prod)
        'TU_MERCHANT_ID_AQUI',                       -- merchantid (tu ID de comercio de OpenPay)
        'TU_PUBLIC_KEY_AQUI',                        -- publickey
        'TU_PRIVATE_KEY_AQUI',                       -- privatekey
        NULL,                                        -- apikey
        3.99,                                        -- comisionporc (3.99%)
        0.00,                                        -- comisionfija
        18.00,                                       -- impuestoporc (IGV 18%)
        'PEN',                                       -- moneda
        'https://sandbox-api.openpay.pe/v1',        -- urlapibase
        'S',                                         -- estado (S = Activo)
        GETDATE()                                    -- feccre
    );
    
    PRINT 'Configuración de OpenPay insertada correctamente';
    
    -- Mostrar el ID asignado
    SELECT idpasarela, nompasarela, codpasarela, ambiente, merchantid
    FROM PasarelaPago 
    WHERE codpasarela = 'OPP';
END
ELSE
BEGIN
    PRINT 'Ya existe una configuración de OpenPay (OPP)';
    
    -- Mostrar configuración existente
    SELECT idpasarela, nompasarela, codpasarela, ambiente, merchantid, estado
    FROM PasarelaPago 
    WHERE codpasarela = 'OPP';
END
GO

-- ============================================================================
-- VERIFICAR QUE LA FK NO CAUSE PROBLEMAS
-- ============================================================================
-- Verificar que exista al menos un registro en PasarelaPago
SELECT 
    'PasarelaPago' as Tabla,
    COUNT(*) as Registros
FROM PasarelaPago
UNION ALL
SELECT 
    'PasarelaApiLog' as Tabla,
    COUNT(*) as Registros  
FROM PasarelaApiLog;
GO
