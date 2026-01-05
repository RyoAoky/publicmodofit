const axios = require('axios');
const crypto = require('crypto');
const { sequelize } = require('../database/conexionsqualize');
const { QueryTypes } = require('sequelize');

// ============================================================================
// CONFIGURACIÓN DE SEGURIDAD
// ============================================================================
const SECURITY_CONFIG = {
    // Límites de montos (PEN)
    MIN_AMOUNT: 1.00,
    MAX_AMOUNT: 50000.00,

    // Rate limiting (peticiones por minuto)
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 30,

    // Retry configuration
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
    RETRY_BACKOFF_MULTIPLIER: 2,

    // Timeouts
    REQUEST_TIMEOUT_MS: 30000,

    // TTL de configuración
    CONFIG_TTL_MS: 3600000, // 1 hora

    // Valores permitidos
    ALLOWED_REPEAT_UNITS: ['day', 'week', 'month', 'year'],
    ALLOWED_CURRENCIES: ['PEN', 'USD'],

    // Longitudes máximas para sanitización
    MAX_NAME_LENGTH: 100,
    MAX_PLAN_ID_LENGTH: 50,
    MAX_BARCODE_LENGTH: 50
};

// ============================================================================
// UTILIDADES DE SEGURIDAD
// ============================================================================

/**
 * Sanitizar string para prevenir inyección
 */
function sanitizeString(str, maxLength = 100) {
    if (typeof str !== 'string') return '';
    return str
        .trim()
        .substring(0, maxLength)
        .replace(/[<>\"'%;()&+]/g, '');
}

/**
 * Validar y sanitizar monto
 */
function validateAmount(amount) {
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount)) {
        throw new Error('El monto debe ser un número válido');
    }

    if (numAmount < SECURITY_CONFIG.MIN_AMOUNT) {
        throw new Error(`El monto mínimo es ${SECURITY_CONFIG.MIN_AMOUNT}`);
    }

    if (numAmount > SECURITY_CONFIG.MAX_AMOUNT) {
        throw new Error(`El monto máximo es ${SECURITY_CONFIG.MAX_AMOUNT}`);
    }

    return Math.round(numAmount * 100) / 100;
}

/**
 * Validar unidad de repetición
 */
function validateRepeatUnit(unit) {
    const sanitized = sanitizeString(unit, 10).toLowerCase();
    if (!SECURITY_CONFIG.ALLOWED_REPEAT_UNITS.includes(sanitized)) {
        throw new Error(`Unidad de repetición inválida: ${unit}`);
    }
    return sanitized;
}

/**
 * Generar ID único para idempotencia
 */
function generateIdempotencyKey(data) {
    const sortedData = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(sortedData).digest('hex').substring(0, 32);
}

/**
 * Enmascarar datos sensibles para logs
 */
function maskSensitiveData(data, depth = 0) {
    if (depth > 10) return '[MAX_DEPTH]';
    if (!data) return data;
    if (typeof data !== 'object') return data;

    if (Array.isArray(data)) {
        return data.map(item => maskSensitiveData(item, depth + 1));
    }

    const masked = {};
    const sensitiveFields = [
        'privatekey', 'publickey', 'password', 'token', 'secret', 'api_key',
        'card_number', 'cvv', 'cvv2', 'cvc', 'expiration', 'pin',
        'account_number', 'routing_number', 'ssn', 'dni'
    ];

    const cardPattern = /^\d{13,19}$/;

    for (const [key, value] of Object.entries(data)) {
        const keyLower = key.toLowerCase();

        if (sensitiveFields.some(field => keyLower.includes(field))) {
            if (typeof value === 'string' && value.length > 8) {
                masked[key] = value.substring(0, 4) + '****' + value.slice(-4);
            } else {
                masked[key] = '****';
            }
        } else if (typeof value === 'string' && cardPattern.test(value.replace(/\s|-/g, ''))) {
            const cleanValue = value.replace(/\s|-/g, '');
            masked[key] = cleanValue.substring(0, 6) + '******' + cleanValue.slice(-4);
        } else if (typeof value === 'object' && value !== null) {
            masked[key] = maskSensitiveData(value, depth + 1);
        } else {
            masked[key] = value;
        }
    }

    return masked;
}

/**
 * Logger seguro que no expone datos sensibles
 */
const secureLogger = {
    info: (message, data = null) => {
        console.log(`[OpenPay INFO] ${message}`, data ? maskSensitiveData(data) : '');
    },
    warn: (message, data = null) => {
        console.warn(`[OpenPay WARN] ${message}`, data ? maskSensitiveData(data) : '');
    },
    error: (message, error = null) => {
        const safeError = error ? {
            message: error.message,
            code: error.code,
            status: error.response?.status
        } : null;
        console.error(`[OpenPay ERROR] ${message}`, safeError);
    }
};

/**
 * Contexto de auditoría para pasar información de la petición
 */
class AuditContext {
    constructor(options = {}) {
        this.idusu = options.idusu || null;
        this.ipaddress = options.ipaddress || null;
        this.useragent = options.useragent || null;
        this.sessionId = options.sessionId || null;
    }

    static fromRequest(req) {
        return new AuditContext({
            idusu: req.user?.idusu || req.body?.idusu || null,
            ipaddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
            useragent: req.headers['user-agent'] || null,
            sessionId: req.sessionID || null
        });
    }

    toObject() {
        return {
            idusu: this.idusu,
            ipaddress: this.ipaddress,
            useragent: this.useragent
        };
    }
}

// ============================================================================
// CLASE PRINCIPAL DEL SERVICIO
// ============================================================================

class OpenPayService {
    constructor() {
        this.config = null;
        this.axiosInstance = null;
        this._initPromise = null;
        this._lastInitTime = null;
        this._configTTL = SECURITY_CONFIG.CONFIG_TTL_MS;

        // Rate limiting
        this._requestCount = 0;
        this._rateLimitResetTime = Date.now();

        // Cache de operaciones para idempotencia
        this._operationCache = new Map();
        this._operationCacheTTL = 300000; // 5 minutos
    }

    // ========================================================================
    // RATE LIMITING
    // ========================================================================

    _checkRateLimit() {
        const now = Date.now();

        if (now - this._rateLimitResetTime > SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS) {
            this._requestCount = 0;
            this._rateLimitResetTime = now;
        }

        this._requestCount++;

        if (this._requestCount > SECURITY_CONFIG.RATE_LIMIT_MAX_REQUESTS) {
            throw new Error('Rate limit excedido. Intente nuevamente en un momento.');
        }
    }

    // ========================================================================
    // IDEMPOTENCIA
    // ========================================================================

    _checkIdempotency(key) {
        this._cleanExpiredOperations();
        return this._operationCache.get(key);
    }

    _registerOperation(key, result) {
        this._operationCache.set(key, {
            result,
            timestamp: Date.now()
        });
    }

    _cleanExpiredOperations() {
        const now = Date.now();
        for (const [key, value] of this._operationCache.entries()) {
            if (now - value.timestamp > this._operationCacheTTL) {
                this._operationCache.delete(key);
            }
        }
    }

    // ========================================================================
    // RETRY CON EXPONENTIAL BACKOFF
    // ========================================================================

    async _executeWithRetry(operation, operationName) {
        let lastError;

        for (let attempt = 1; attempt <= SECURITY_CONFIG.MAX_RETRIES; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                const status = error.response?.status;
                if (status === 400 || status === 401 || status === 403 || status === 422) {
                    throw error;
                }

                if (attempt < SECURITY_CONFIG.MAX_RETRIES) {
                    const delay = SECURITY_CONFIG.RETRY_DELAY_MS *
                        Math.pow(SECURITY_CONFIG.RETRY_BACKOFF_MULTIPLIER, attempt - 1);
                    secureLogger.warn(`${operationName} - Intento ${attempt} fallido, reintentando en ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    // ========================================================================
    // LOGGING DE API Y AUDITORÍA
    // ========================================================================

    /**
     * Registrar acción en PasarelaAuditoria
     * @param {Object} auditData - Datos de auditoría
     */
    async _registrarAuditoria(auditData) {
        try {
            const {
                tablaafectada,
                idregistro,
                accion,
                camposcambiados,
                idusu,
                ipaddress,
                useragent
            } = auditData;

            await sequelize.query(
                `INSERT INTO PasarelaAuditoria (
                    tablaafectada, idregistro, accion, camposcambiados,
                    idusu, ipaddress, useragent, fecaudit
                ) VALUES (
                    :tablaafectada, :idregistro, :accion, :camposcambiados,
                    :idusu, :ipaddress, :useragent, GETDATE()
                )`,
                {
                    replacements: {
                        tablaafectada: sanitizeString(tablaafectada, 100),
                        idregistro: idregistro || 0,
                        accion: sanitizeString(accion, 20),
                        camposcambiados: camposcambiados ? JSON.stringify(maskSensitiveData(camposcambiados)) : null,
                        idusu: idusu || null,
                        ipaddress: sanitizeString(ipaddress, 45),
                        useragent: sanitizeString(useragent, 500)
                    },
                    type: QueryTypes.INSERT
                }
            );

        } catch (error) {
            secureLogger.error('Error al registrar auditoría', error);
            // No lanzar error para no interrumpir el flujo principal
        }
    }

    /**
     * Registrar INICIO de petición API en PasarelaApiLog (ANTES de llamar a OpenPay)
     * @param {Object} logData - Datos de la petición
     * @returns {Promise<number|null>} - ID del log insertado
     */
    async _registrarApiLogInicio(logData) {
        try {
            const {
                metodohttp,
                endpoint,
                operacion,
                bodyenviado,
                idusu,
                ipaddress,
                useragent,
                correlationid
            } = logData;

            console.log('[ApiLog] Registrando INICIO de petición:', { operacion, endpoint });

            await sequelize.query(
                `INSERT INTO PasarelaApiLog (
                    idpasarela, metodohttp, endpoint, operacion,
                    bodyenviado, fecinicio,
                    esexitoso, idusu, ipaddress, useragent, 
                    idempotencykey, correlationid, numerointento
                ) VALUES (
                    :idpasarela, :metodohttp, :endpoint, :operacion,
                    :bodyenviado, GETDATE(),
                    'N', :idusu, :ipaddress, :useragent, 
                    :idempotencykey, :correlationid, 1
                )`,
                {
                    replacements: {
                        idpasarela: this.config?.idpasarela || 1,
                        metodohttp: sanitizeString(metodohttp, 10),
                        endpoint: sanitizeString(endpoint, 500),
                        operacion: sanitizeString(operacion, 50),
                        bodyenviado: bodyenviado ? JSON.stringify(maskSensitiveData(bodyenviado)) : null,
                        idusu: idusu || null,
                        ipaddress: sanitizeString(ipaddress, 45) || null,
                        useragent: sanitizeString(useragent, 500) || null,
                        idempotencykey: sanitizeString(correlationid, 100),
                        correlationid: sanitizeString(correlationid, 100)
                    },
                    type: QueryTypes.INSERT
                }
            );

            // Obtener ID insertado
            const result = await sequelize.query(
                `SELECT TOP 1 idapilog FROM PasarelaApiLog ORDER BY idapilog DESC`,
                { type: QueryTypes.SELECT }
            );

            const idapilog = result[0]?.idapilog || null;
            console.log('[ApiLog] INICIO registrado, idapilog:', idapilog);
            return idapilog;

        } catch (error) {
            console.error('[ApiLog] ERROR al registrar inicio:', error.message);
            return null;
        }
    }

    /**
     * Actualizar PasarelaApiLog con la respuesta (DESPUÉS de llamar a OpenPay)
     * @param {number} idapilog - ID del registro a actualizar
     * @param {Object} responseData - Datos de la respuesta
     */
    async _actualizarApiLogRespuesta(idapilog, responseData) {
        if (!idapilog) return;

        try {
            const {
                httpstatuscode,
                bodyrecibido,
                tiemporespuestams,
                esexitoso,
                codigoerror,
                mensajeerror
            } = responseData;

            console.log('[ApiLog] Actualizando respuesta, idapilog:', idapilog, 'exitoso:', esexitoso);

            await sequelize.query(
                `UPDATE PasarelaApiLog SET
                    httpstatuscode = :httpstatuscode,
                    bodyrecibido = :bodyrecibido,
                    fecfin = GETDATE(),
                    tiemporespuestams = :tiemporespuestams,
                    esexitoso = :esexitoso,
                    codigoerror = :codigoerror,
                    mensajeerror = :mensajeerror
                 WHERE idapilog = :idapilog`,
                {
                    replacements: {
                        idapilog,
                        httpstatuscode: httpstatuscode || null,
                        bodyrecibido: bodyrecibido ? JSON.stringify(maskSensitiveData(bodyrecibido)) : null,
                        tiemporespuestams: tiemporespuestams || 0,
                        esexitoso: esexitoso ? 'S' : 'N',
                        codigoerror: sanitizeString(codigoerror, 50) || null,
                        mensajeerror: sanitizeString(mensajeerror, 500) || null
                    },
                    type: QueryTypes.UPDATE
                }
            );

            console.log('[ApiLog] Respuesta actualizada exitosamente');

        } catch (error) {
            console.error('[ApiLog] ERROR al actualizar respuesta:', error.message);
        }
    }

    /**
     * Ejecutar operación API con logging automático
     * FLUJO:
     * 1. Registrar INICIO en PasarelaApiLog (obtener idapilog)
     * 2. Llamar a OpenPay
     * 3. Actualizar PasarelaApiLog con la respuesta
     * 4. Registrar en PasarelaAuditoria
     * 5. Retornar respuesta con idapilog
     * 
     * @param {Function} operation - Función que ejecuta la llamada API
     * @param {Object} options - Opciones de logging
     * @returns {Object} - { response, idapilog }
     */
    async _executeWithLogging(operation, options = {}) {
        const {
            metodohttp = 'POST',
            endpoint = '',
            operacion = 'UNKNOWN',
            bodyenviado = null,
            auditContext = null
        } = options;

        const startTime = Date.now();
        const correlationid = generateIdempotencyKey({ operacion, timestamp: startTime });

        let response = null;
        let idapilog = null;

        // ================================================================
        // PASO 1: Registrar INICIO en PasarelaApiLog (ANTES de OpenPay)
        // ================================================================
        idapilog = await this._registrarApiLogInicio({
            metodohttp,
            endpoint,
            operacion,
            bodyenviado,
            idusu: auditContext?.idusu,
            ipaddress: auditContext?.ipaddress,
            useragent: auditContext?.useragent,
            correlationid
        });

        try {
            // ================================================================
            // PASO 2: Llamar a OpenPay
            // ================================================================
            response = await this._executeWithRetry(operation, operacion);
            const httpstatuscode = response?.status || 200;
            const bodyrecibido = response?.data || response;
            const tiemporespuestams = Date.now() - startTime;

            // ================================================================
            // PASO 3: Actualizar PasarelaApiLog con la respuesta exitosa
            // ================================================================
            await this._actualizarApiLogRespuesta(idapilog, {
                httpstatuscode,
                bodyrecibido,
                tiemporespuestams,
                esexitoso: true,
                codigoerror: null,
                mensajeerror: null
            });

            // ================================================================
            // PASO 4: Registrar en PasarelaAuditoria
            // ================================================================
            await this._registrarAuditoria({
                tablaafectada: 'PasarelaApiLog',
                idregistro: idapilog,
                accion: 'API_CALL_SUCCESS',
                camposcambiados: {
                    operacion,
                    endpoint,
                    httpstatuscode,
                    idexterno: bodyrecibido?.id || null
                },
                idusu: auditContext?.idusu,
                ipaddress: auditContext?.ipaddress,
                useragent: auditContext?.useragent
            });

            // Agregar idapilog a la respuesta para trazabilidad
            response._idapilog = idapilog;
            return response;

        } catch (err) {
            const httpstatuscode = err.response?.status || 500;
            const bodyrecibido = err.response?.data || { error: err.message };
            const tiemporespuestams = Date.now() - startTime;

            // ================================================================
            // PASO 3: Actualizar PasarelaApiLog con el error
            // ================================================================
            await this._actualizarApiLogRespuesta(idapilog, {
                httpstatuscode,
                bodyrecibido,
                tiemporespuestams,
                esexitoso: false,
                codigoerror: err.response?.data?.error_code || err.code || 'ERROR',
                mensajeerror: err.response?.data?.description || err.message
            });

            // ================================================================
            // PASO 4: Registrar error en PasarelaAuditoria
            // ================================================================
            await this._registrarAuditoria({
                tablaafectada: 'PasarelaApiLog',
                idregistro: idapilog,
                accion: 'API_CALL_ERROR',
                camposcambiados: {
                    operacion,
                    endpoint,
                    httpstatuscode,
                    error: err.message
                },
                idusu: auditContext?.idusu,
                ipaddress: auditContext?.ipaddress,
                useragent: auditContext?.useragent
            });

            // Agregar idapilog al error para trazabilidad
            err._idapilog = idapilog;
            throw err;
        }
    }

    // ========================================================================
    // GESTIÓN DE SESIONES DE PAGO
    // ========================================================================

    /**
     * Crear una nueva sesión de pago
     */
    async crearSesionPago(data) {
        try {
            await this.ensureInitialized();

            const sessionid = generateIdempotencyKey({
                idusu: data.idusu,
                timestamp: Date.now(),
                random: Math.random()
            });

            await sequelize.query(
                `INSERT INTO PasarelaSesion (
                    idpasarela, idusu, dniusu, sessionid, devicesessionid,
                    useragent, ipaddress, plataforma, barcpro, montintentado,
                    estsesion, fecinicio, fecultactividad, fecexpiracion
                ) VALUES (
                    :idpasarela, :idusu, :dniusu, :sessionid, :devicesessionid,
                    :useragent, :ipaddress, :plataforma, :barcpro, :montintentado,
                    'S', GETDATE(), GETDATE(), DATEADD(HOUR, 1, GETDATE())
                )`,
                {
                    replacements: {
                        idpasarela: this.config.idpasarela,
                        idusu: data.idusu || null,
                        dniusu: sanitizeString(data.dniusu, 10),
                        sessionid,
                        devicesessionid: sanitizeString(data.devicesessionid, 150),
                        useragent: sanitizeString(data.useragent, 500),
                        ipaddress: sanitizeString(data.ipaddress, 45),
                        plataforma: sanitizeString(data.plataforma || 'WEB', 50),
                        barcpro: sanitizeString(data.barcpro, 100),
                        montintentado: data.montintentado || null
                    },
                    type: QueryTypes.INSERT
                }
            );

            // Obtener ID insertado
            const result = await sequelize.query(
                `SELECT TOP 1 idsesionpas FROM PasarelaSesion 
                 WHERE sessionid = :sessionid`,
                {
                    replacements: { sessionid },
                    type: QueryTypes.SELECT
                }
            );

            const idsesionpas = result[0]?.idsesionpas;

            // Registrar en historial
            await this._registrarSesionHistorial(idsesionpas, 'INICIO', 'Sesión de pago iniciada', data.ipaddress);

            secureLogger.info('Sesión de pago creada', { idsesionpas, sessionid });
            return { success: true, idsesionpas, sessionid };

        } catch (error) {
            secureLogger.error('Error al crear sesión de pago', error);
            return { success: false, error: 'Error al crear sesión de pago' };
        }
    }

    /**
     * Actualizar sesión de pago
     */
    async actualizarSesionPago(idsesionpas, data) {
        try {
            await sequelize.query(
                `UPDATE PasarelaSesion SET
                    estsesion = COALESCE(:estsesion, estsesion),
                    intentospago = COALESCE(:intentospago, intentospago),
                    idtranspas = COALESCE(:idtranspas, idtranspas),
                    idapilog = COALESCE(:idapilog, idapilog),
                    fecultactividad = GETDATE(),
                    fecfin = CASE WHEN :estsesion IN ('C', 'F', 'E') THEN GETDATE() ELSE fecfin END
                 WHERE idsesionpas = :idsesionpas`,
                {
                    replacements: {
                        idsesionpas,
                        estsesion: data.estsesion || null,
                        intentospago: data.intentospago || null,
                        idtranspas: data.idtranspas || null,
                        idapilog: data.idapilog || null
                    },
                    type: QueryTypes.UPDATE
                }
            );

            return { success: true };
        } catch (error) {
            secureLogger.error('Error al actualizar sesión', error);
            return { success: false };
        }
    }

    /**
     * Registrar en historial de sesión
     */
    async _registrarSesionHistorial(idsesionpas, accion, detalle, ipaddress = null, datosAdicionales = null) {
        try {
            await sequelize.query(
                `INSERT INTO PasarelaSesionHistorial (
                    idsesionpas, accion, detalleaccion, ipaddress, datosadicionales, fecaccion
                ) VALUES (
                    :idsesionpas, :accion, :detalle, :ipaddress, :datosadicionales, GETDATE()
                )`,
                {
                    replacements: {
                        idsesionpas,
                        accion: sanitizeString(accion, 50),
                        detalle: sanitizeString(detalle, 500),
                        ipaddress: sanitizeString(ipaddress, 45),
                        datosadicionales: datosAdicionales ? JSON.stringify(maskSensitiveData(datosAdicionales)) : null
                    },
                    type: QueryTypes.INSERT
                }
            );
        } catch (error) {
            secureLogger.error('Error al registrar historial de sesión', error);
        }
    }

    // ========================================================================
    // GESTIÓN DE CAJA VIRTUAL
    // ========================================================================

    /**
     * Obtener o crear caja virtual del día
     * NOTA: Ahora usa tabla Caja unificada con tipocaja='V'
     */
    async obtenerOCrearCajaVirtual() {
        try {
            await this.ensureInitialized();
            const idpasarela = this.config.idpasarela;
            const fechaHoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

            // Buscar caja virtual del día actual en tabla Caja unificada
            let result = await sequelize.query(
                `SELECT c.idcaja, c.estcaja, c.fecoperacion,
                        cdp.canttransacciones, cdp.montbruto, 
                        cdp.montcomision, cdp.montiva, cdp.montneto
                 FROM Caja c
                 LEFT JOIN CajaDetallePasarela cdp ON c.idcaja = cdp.idcaja
                 WHERE c.tipocaja = 'V'
                   AND c.idpasarela = :idpasarela 
                   AND c.fecoperacion = CAST(GETDATE() AS DATE)
                   AND c.estcaja = 'S'`,
                {
                    replacements: { idpasarela },
                    type: QueryTypes.SELECT
                }
            );

            if (result.length > 0) {
                // Retornar con formato compatible (idcaja )
                return {
                    success: true,
                    cajaVirtual: {
                        idcaja: result[0].idcaja,
                        idcajavirtual: result[0].idcaja, // Alias para compatibilidad
                        ...result[0]
                    },
                    nueva: false
                };
            }

            // Cerrar cajas virtuales anteriores que quedaron abiertas
            await sequelize.query(
                `UPDATE Caja SET estcaja = 'C', cierre = GETDATE()
                 WHERE tipocaja = 'V' AND idpasarela = :idpasarela 
                   AND estcaja = 'S' AND fecoperacion < CAST(GETDATE() AS DATE)`,
                {
                    replacements: { idpasarela },
                    type: QueryTypes.UPDATE
                }
            );

            // Crear nueva caja virtual del día
            await sequelize.query(
                `INSERT INTO Caja (
                    apertura, montinicaja, montfincaja, idusu,
                    tipocaja, origenapertura, estcaja, fecoperacion, idpasarela
                ) VALUES (
                    GETDATE(), 0, 0, 0,
                    'V', 'S', 'S', CAST(GETDATE() AS DATE), :idpasarela
                )`,
                {
                    replacements: { idpasarela },
                    type: QueryTypes.INSERT
                }
            );

            result = await sequelize.query(
                `SELECT TOP 1 idcaja FROM Caja 
                 WHERE tipocaja = 'V' AND idpasarela = :idpasarela 
                 ORDER BY idcaja DESC`,
                {
                    replacements: { idpasarela },
                    type: QueryTypes.SELECT
                }
            );

            const idcaja = result[0]?.idcaja;

            // Crear registro de extensión para detalles de pasarela
            await sequelize.query(
                `INSERT INTO CajaDetallePasarela (
                    idcaja, idpasarela, canttransacciones, montbruto, montneto
                ) VALUES (
                    :idcaja, :idpasarela, 0, 0, 0
                )`,
                {
                    replacements: { idcaja, idpasarela },
                    type: QueryTypes.INSERT
                }
            );

            secureLogger.info('Caja virtual creada (tabla Caja unificada)', { idcaja });
            return {
                success: true,
                cajaVirtual: {
                    idcaja,
                    idcajavirtual: idcaja // Alias para compatibilidad
                },
                nueva: true
            };

        } catch (error) {
            secureLogger.error('Error al obtener/crear caja virtual', error);
            return { success: false, error: 'Error con caja virtual' };
        }
    }

    /**
     * Actualizar totales de caja virtual
     * NOTA: Ahora actualiza tabla Caja + CajaDetallePasarela
     * @param {number} idcaja - ID de la caja (puede venir como idcajavirtual por compatibilidad)
     */
    async actualizarCajaVirtual(idcaja, monto, comision = 0, impuesto = 0) {
        try {
            const neto = monto - comision - impuesto;

            // Actualizar tabla Caja principal
            await sequelize.query(
                `UPDATE Caja SET
                    montfincaja = ISNULL(montfincaja, 0) + :monto
                 WHERE idcaja = :idcaja`,
                {
                    replacements: { idcaja, monto },
                    type: QueryTypes.UPDATE
                }
            );

            // Actualizar tabla de extensión CajaDetallePasarela
            await sequelize.query(
                `UPDATE CajaDetallePasarela SET
                    canttransacciones = canttransacciones + 1,
                    cantaprobadas = cantaprobadas + 1,
                    montbruto = montbruto + :monto,
                    montcomision = montcomision + :comision,
                    montiva = montiva + :impuesto,
                    montneto = montneto + :neto,
                    fecmov = GETDATE()
                 WHERE idcaja = :idcaja`,
                {
                    replacements: { idcaja, monto, comision, impuesto, neto },
                    type: QueryTypes.UPDATE
                }
            );

            return { success: true };
        } catch (error) {
            secureLogger.error('Error al actualizar caja virtual', error);
            return { success: false };
        }
    }



    // ========================================================================
    // GESTIÓN DE TRANSACCIONES
    // ========================================================================

    /**
     * Registrar transacción en PasarelaTransaccion
     */
    async registrarTransaccion(data) {
        try {
            await this.ensureInitialized();

            // Obtener o crear caja virtual del día
            const cajaResult = await this.obtenerOCrearCajaVirtual();
            const idcajavirtual = cajaResult.cajaVirtual?.idcajavirtual || null;

            // Obtener estado de la pasarela
            const estadoResult = await sequelize.query(
                `SELECT TOP 1 idestadopas FROM PasarelaEstado 
                 WHERE idpasarela = :idpasarela AND codestadoext = :codestado`,
                {
                    replacements: {
                        idpasarela: this.config.idpasarela,
                        codestado: data.estadoext || 'in_progress'
                    },
                    type: QueryTypes.SELECT
                }
            );

            // Obtener tipo de transacción
            const tipoResult = await sequelize.query(
                `SELECT TOP 1 idtipotrans FROM PasarelaTipoTransaccion 
                 WHERE codtipotrans = :codtipo`,
                {
                    replacements: { codtipo: data.tipotransaccion || 'COBRO' },
                    type: QueryTypes.SELECT
                }
            );

            // Calcular montos
            const montbruto = data.montbruto || 0;
            const montcomisionvar = data.montcomision || 0;
            const montimpuestocom = data.montimpuesto || 0;
            const montneto = montbruto - montcomisionvar - montimpuestocom;

            await sequelize.query(
                `INSERT INTO PasarelaTransaccion (
                    idpasarela, idcajavirtual, idusu, dniusu, idven, idmem,
                    idsuscpas, idsesionpas, idtransext, referenciaorden,
                    idtipotrans, idestadopas, montbruto, montcomisionvar,
                    montimpuestocom, montneto, moneda, idtarjpas,
                    jsonresponse, ipaddress, useragent,
                    estado, fectransaccion
                ) VALUES (
                    :idpasarela, :idcajavirtual, :idusu, :dniusu, :idven, :idmem,
                    :idsuscpas, :idsesionpas, :idtransext, :referenciaorden,
                    :idtipotrans, :idestadopas, :montbruto, :montcomisionvar,
                    :montimpuestocom, :montneto, :moneda, :idtarjpas,
                    :jsonresponse, :ipaddress, :useragent,
                    'S', GETDATE()
                )`,
                {
                    replacements: {
                        idpasarela: this.config.idpasarela,
                        idcajavirtual,
                        idusu: data.idusu || null,
                        dniusu: sanitizeString(data.dniusu, 10),
                        idven: data.idven || null,
                        idmem: data.idmem || null,
                        idsuscpas: data.idsuscpas || null,
                        idsesionpas: data.idsesionpas || null,
                        idtransext: sanitizeString(data.idtransext, 100),
                        referenciaorden: sanitizeString(data.referenciaorden, 50),
                        idtipotrans: tipoResult[0]?.idtipotrans || 1,
                        idestadopas: estadoResult[0]?.idestadopas || 1,
                        montbruto,
                        montcomisionvar,
                        montimpuestocom,
                        montneto,
                        moneda: data.moneda || 'PEN',
                        idtarjpas: data.idtarjpas || null,
                        jsonresponse: data.jsonresponse ? JSON.stringify(maskSensitiveData(data.jsonresponse)) : null,
                        ipaddress: sanitizeString(data.ipaddress, 45) || null,
                        useragent: sanitizeString(data.useragent, 500) || null
                    },
                    type: QueryTypes.INSERT
                }
            );

            // Obtener ID insertado
            const result = await sequelize.query(
                `SELECT TOP 1 idtranspas FROM PasarelaTransaccion 
                 WHERE idpasarela = :idpasarela ORDER BY idtranspas DESC`,
                {
                    replacements: { idpasarela: this.config.idpasarela },
                    type: QueryTypes.SELECT
                }
            );

            const idtranspas = result[0]?.idtranspas;

            // Actualizar caja virtual si el cobro fue exitoso
            if (data.estadoext === 'completed' || data.estadoext === 'charged') {
                await this.actualizarCajaVirtual(
                    idcajavirtual,
                    montbruto,
                    montcomisionvar,
                    montimpuestocom
                );
            }

            // Registrar auditoría
            await this._registrarAuditoria({
                tablaafectada: 'PasarelaTransaccion',
                idregistro: idtranspas,
                accion: 'INSERT',
                camposcambiados: {
                    idtransext: data.idtransext,
                    montbruto,
                    estadoext: data.estadoext
                },
                idusu: data.idusu
            });

            secureLogger.info('Transacción registrada', { idtranspas, idtransext: data.idtransext });
            return { success: true, idtranspas };

        } catch (error) {
            secureLogger.error('Error al registrar transacción', error);
            return { success: false, error: 'Error al registrar transacción' };
        }
    }

    /**
     * Actualizar estado de transacción
     */
    async actualizarEstadoTransaccion(idtranspas, nuevoEstado, jsonResponse = null) {
        try {
            await this.ensureInitialized();

            const estadoResult = await sequelize.query(
                `SELECT TOP 1 idestadopas FROM PasarelaEstado 
                 WHERE idpasarela = :idpasarela AND codestadoext = :codestado`,
                {
                    replacements: {
                        idpasarela: this.config.idpasarela,
                        codestado: nuevoEstado
                    },
                    type: QueryTypes.SELECT
                }
            );

            await sequelize.query(
                `UPDATE PasarelaTransaccion SET
                    idestadopas = :idestadopas,
                    jsonresponse = COALESCE(:jsonresponse, jsonresponse),
                    fecmov = GETDATE()
                 WHERE idtranspas = :idtranspas`,
                {
                    replacements: {
                        idtranspas,
                        idestadopas: estadoResult[0]?.idestadopas || null,
                        jsonresponse: jsonResponse ? JSON.stringify(maskSensitiveData(jsonResponse)) : null
                    },
                    type: QueryTypes.UPDATE
                }
            );

            return { success: true };
        } catch (error) {
            secureLogger.error('Error al actualizar estado de transacción', error);
            return { success: false };
        }
    }

    // ========================================================================
    // INICIALIZACIÓN
    // ========================================================================

    async ensureInitialized() {
        if (this.config && this.axiosInstance) {
            const configExpired = this._lastInitTime &&
                (Date.now() - this._lastInitTime > this._configTTL);

            if (!configExpired) {
                return true;
            }
            secureLogger.info('Configuración expirada, recargando...');
        }

        if (this._initPromise) {
            return this._initPromise;
        }

        this._initPromise = this.initialize()
            .finally(() => {
                this._initPromise = null;
            });

        return this._initPromise;
    }

    async initialize() {
        try {
            secureLogger.info('Inicializando servicio OpenPay...');

            const result = await sequelize.query(
                `SELECT TOP 1 idpasarela, nompasarela, merchantid, privatekey, publickey, 
                        ambiente, moneda, estado, urlapibase
                 FROM PasarelaPago 
                 WHERE codpasarela = 'OPP' AND estado = 'S'`,
                { type: QueryTypes.SELECT }
            );

            if (result.length === 0) {
                throw new Error('Configuración de pasarela OpenPay no encontrada o inactiva');
            }

            const configData = result[0];

            if (!configData.merchantid || !configData.privatekey) {
                throw new Error('Configuración de pasarela incompleta');
            }

            this.config = configData;

            const baseUrl = this.config.ambiente === 'PRODUCTION'
                ? `https://api.openpay.pe/v1/${this.config.merchantid}`
                : `https://sandbox-api.openpay.pe/v1/${this.config.merchantid}`;

            this.axiosInstance = axios.create({
                baseURL: baseUrl,
                auth: {
                    username: this.config.privatekey,
                    password: ''
                },
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'ModoFit-Public/1.0',
                    'Accept': 'application/json'
                },
                timeout: SECURITY_CONFIG.REQUEST_TIMEOUT_MS,
                maxRedirects: 0,
                validateStatus: status => status >= 200 && status < 300
            });

            this._lastInitTime = Date.now();
            secureLogger.info(`Inicializado correctamente - Ambiente: ${this.config.ambiente}`);
            return true;

        } catch (error) {
            secureLogger.error('Error al inicializar', error);
            this.config = null;
            this.axiosInstance = null;
            this._lastInitTime = null;
            throw new Error('Error al inicializar servicio de pagos');
        }
    }

    async reloadConfig() {
        secureLogger.info('Recargando configuración...');
        this.config = null;
        this.axiosInstance = null;
        this._lastInitTime = null;
        this._operationCache.clear();
        return this.ensureInitialized();
    }

    // ========================================================================
    // OPERACIONES DE CLIENTES
    // ========================================================================

    /**
     * Crear un cliente en OpenPay
     */
    async crearCliente(clienteData, auditContext = {}) {
        try {
            this._checkRateLimit();
            await this.ensureInitialized();

            const validatedData = {
                name: sanitizeString(clienteData.name, SECURITY_CONFIG.MAX_NAME_LENGTH),
                email: clienteData.email?.trim().toLowerCase()
            };

            if (!validatedData.name || validatedData.name.length < 2) {
                throw new Error('El nombre del cliente debe tener al menos 2 caracteres');
            }

            if (!validatedData.email || !validatedData.email.includes('@')) {
                throw new Error('Se requiere un email válido');
            }

            if (clienteData.last_name) {
                validatedData.last_name = sanitizeString(clienteData.last_name, SECURITY_CONFIG.MAX_NAME_LENGTH);
            }

            if (clienteData.phone_number) {
                validatedData.phone_number = clienteData.phone_number.replace(/[^0-9]/g, '').substring(0, 15);
            }

            if (clienteData.external_id) {
                validatedData.external_id = sanitizeString(clienteData.external_id, 100);
            }

            validatedData.requires_account = false;

            const idempotencyKey = generateIdempotencyKey({
                operation: 'CREATE_CUSTOMER',
                email: validatedData.email,
                external_id: validatedData.external_id
            });

            const cachedResult = this._checkIdempotency(idempotencyKey);
            if (cachedResult) {
                secureLogger.info('Retornando resultado cacheado (idempotencia) para crearCliente');
                return cachedResult.result;
            }

            secureLogger.info('Creando cliente en OpenPay', {
                name: validatedData.name,
                external_id: validatedData.external_id
            });

            const response = await this._executeWithLogging(
                () => this.axiosInstance.post('/customers', validatedData),
                {
                    metodohttp: 'POST',
                    endpoint: '/customers',
                    operacion: 'CREATE_CUSTOMER',
                    bodyenviado: validatedData,
                    auditContext
                }
            );

            if (response.data && response.data.id) {
                const result = {
                    success: true,
                    cliente: {
                        id: response.data.id,
                        name: response.data.name,
                        last_name: response.data.last_name,
                        email: response.data.email,
                        phone_number: response.data.phone_number,
                        external_id: response.data.external_id,
                        status: response.data.status,
                        creation_date: response.data.creation_date
                    },
                    idapilog: response._idapilog // Agregar idapilog para trazabilidad
                };

                this._registerOperation(idempotencyKey, result);
                secureLogger.info('Cliente creado exitosamente', { clienteId: response.data.id, idapilog: response._idapilog });
                return result;
            }

            throw new Error('Respuesta inválida del servidor de pagos');

        } catch (error) {
            secureLogger.error('Error al crear cliente', error);

            let userMessage = 'Error al crear cliente en la pasarela de pagos';
            if (error.response?.data?.description) {
                userMessage = error.response.data.description;
            } else if (error.message && !error.message.includes('internal')) {
                userMessage = error.message;
            }

            return {
                success: false,
                error: userMessage,
                code: error.response?.data?.error_code || 'UNKNOWN_ERROR'
            };
        }
    }

    /**
     * Obtener un cliente de OpenPay
     */
    async obtenerCliente(customerId, auditContext = {}) {
        try {
            this._checkRateLimit();
            await this.ensureInitialized();

            const sanitizedId = sanitizeString(customerId, 100);
            if (!sanitizedId || sanitizedId.length < 5) {
                throw new Error('ID de cliente inválido');
            }

            secureLogger.info('Obteniendo cliente', { customerId: sanitizedId });

            const response = await this._executeWithLogging(
                () => this.axiosInstance.get(`/customers/${sanitizedId}`),
                {
                    metodohttp: 'GET',
                    endpoint: `/customers/${sanitizedId}`,
                    operacion: 'GET_CUSTOMER',
                    bodyenviado: null,
                    auditContext
                }
            );

            if (response.data && response.data.id) {
                return {
                    success: true,
                    cliente: {
                        id: response.data.id,
                        name: response.data.name,
                        last_name: response.data.last_name,
                        email: response.data.email,
                        phone_number: response.data.phone_number,
                        external_id: response.data.external_id,
                        status: response.data.status,
                        creation_date: response.data.creation_date
                    },
                    idapilog: response._idapilog
                };
            }

            throw new Error('Respuesta inválida del servidor de pagos');

        } catch (error) {
            secureLogger.error('Error al obtener cliente', error);

            if (error.response?.status === 404) {
                return {
                    success: false,
                    error: 'Cliente no encontrado en la pasarela',
                    code: 'NOT_FOUND'
                };
            }

            return {
                success: false,
                error: error.response?.data?.description || 'Error al obtener cliente',
                code: error.response?.data?.error_code || 'UNKNOWN_ERROR'
            };
        }
    }

    /**
     * Guardar cliente en tabla local PasarelaCliente
     */
    async guardarClienteLocal(data) {
        try {
            await this.ensureInitialized();

            const validatedIdusu = parseInt(data.idusu, 10);
            if (isNaN(validatedIdusu) || validatedIdusu < 1) {
                throw new Error('ID de usuario inválido');
            }

            const dniusu = sanitizeString(data.dniusu, 15);
            const idcliext = sanitizeString(data.idcliext, 100);

            if (!idcliext) {
                throw new Error('ID de cliente externo requerido');
            }

            // Verificar si ya existe
            const checkResult = await sequelize.query(
                `SELECT idclipas FROM PasarelaCliente 
                 WHERE idusu = :idusu AND idpasarela = :idpasarela AND estado = 'S'`,
                {
                    replacements: {
                        idusu: validatedIdusu,
                        idpasarela: this.config.idpasarela
                    },
                    type: QueryTypes.SELECT
                }
            );

            if (checkResult.length > 0) {
                // Actualizar existente
                await sequelize.query(
                    `UPDATE PasarelaCliente SET 
                        idcliext = :idcliext,
                        emailregistrado = :email,
                        telefonoregistrado = :telefono,
                        idapilog = COALESCE(:idapilog, idapilog),
                        fecmov = GETDATE(),
                        estado = 'S'
                     WHERE idclipas = :idclipas`,
                    {
                        replacements: {
                            idcliext,
                            email: data.email || null,
                            telefono: data.telefono || null,
                            idapilog: data.idapilog || null,
                            idclipas: checkResult[0].idclipas
                        },
                        type: QueryTypes.UPDATE
                    }
                );

                secureLogger.info('Cliente local actualizado', { idclipas: checkResult[0].idclipas, idapilog: data.idapilog });

                // Registrar auditoría
                await this._registrarAuditoria({
                    tablaafectada: 'PasarelaCliente',
                    idregistro: checkResult[0].idclipas,
                    accion: 'UPDATE',
                    camposcambiados: { idcliext, email: data.email, telefono: data.telefono, idapilog: data.idapilog },
                    idusu: validatedIdusu
                });

                return { success: true, idclipas: checkResult[0].idclipas, updated: true };
            } else {
                // Insertar nuevo
                await sequelize.query(
                    `INSERT INTO PasarelaCliente (
                        idpasarela, idusu, dniusu, idcliext, emailregistrado, 
                        telefonoregistrado, idapilog, estado, feccre
                    ) VALUES (
                        :idpasarela, :idusu, :dniusu, :idcliext, :email, 
                        :telefono, :idapilog, 'S', GETDATE()
                    )`,
                    {
                        replacements: {
                            idpasarela: this.config.idpasarela,
                            idusu: validatedIdusu,
                            dniusu,
                            idcliext,
                            email: data.email || null,
                            telefono: data.telefono || null,
                            idapilog: data.idapilog || null
                        },
                        type: QueryTypes.INSERT
                    }
                );

                // Obtener ID insertado
                const insertedCliente = await sequelize.query(
                    `SELECT TOP 1 idclipas FROM PasarelaCliente 
                     WHERE idusu = :idusu AND idpasarela = :idpasarela 
                     ORDER BY idclipas DESC`,
                    {
                        replacements: {
                            idusu: validatedIdusu,
                            idpasarela: this.config.idpasarela
                        },
                        type: QueryTypes.SELECT
                    }
                );

                secureLogger.info('Cliente local insertado', { idclipas: insertedCliente[0]?.idclipas });

                // Registrar auditoría
                await this._registrarAuditoria({
                    tablaafectada: 'PasarelaCliente',
                    idregistro: insertedCliente[0]?.idclipas,
                    accion: 'INSERT',
                    camposcambiados: { idusu: validatedIdusu, dniusu, idcliext, email: data.email },
                    idusu: validatedIdusu
                });

                return { success: true, idclipas: insertedCliente[0]?.idclipas, inserted: true };
            }

        } catch (error) {
            secureLogger.error('Error al guardar cliente local', error);
            return {
                success: false,
                error: 'Error al guardar cliente en base de datos local'
            };
        }
    }

    /**
     * Obtener cliente de la tabla local PasarelaCliente
     */
    async obtenerClienteLocal(idusu) {
        try {
            await this.ensureInitialized();

            const validatedIdusu = parseInt(idusu, 10);
            if (isNaN(validatedIdusu) || validatedIdusu < 1) {
                return null;
            }

            const result = await sequelize.query(
                `SELECT pc.idclipas, pc.idpasarela, pc.idusu, pc.dniusu, 
                        pc.idcliext, pc.emailregistrado, pc.telefonoregistrado,
                        pc.estado, pc.feccre, pc.fecmov
                 FROM PasarelaCliente pc
                 WHERE pc.idusu = :idusu AND pc.idpasarela = :idpasarela AND pc.estado = 'S'`,
                {
                    replacements: {
                        idusu: validatedIdusu,
                        idpasarela: this.config.idpasarela
                    },
                    type: QueryTypes.SELECT
                }
            );

            return result.length > 0 ? result[0] : null;

        } catch (error) {
            secureLogger.error('Error al obtener cliente local', error);
            return null;
        }
    }

    /**
     * Buscar cliente local por DNI
     */
    async obtenerClienteLocalPorDni(dniusu) {
        try {
            await this.ensureInitialized();

            const dni = sanitizeString(dniusu, 15);
            if (!dni) return null;

            const result = await sequelize.query(
                `SELECT pc.idclipas, pc.idpasarela, pc.idusu, pc.dniusu, 
                        pc.idcliext, pc.emailregistrado, pc.telefonoregistrado,
                        pc.estado, pc.feccre, pc.fecmov
                 FROM PasarelaCliente pc
                 WHERE pc.dniusu = :dniusu AND pc.idpasarela = :idpasarela AND pc.estado = 'S'`,
                {
                    replacements: {
                        dniusu: dni,
                        idpasarela: this.config.idpasarela
                    },
                    type: QueryTypes.SELECT
                }
            );

            return result.length > 0 ? result[0] : null;

        } catch (error) {
            secureLogger.error('Error al obtener cliente local por DNI', error);
            return null;
        }
    }

    // ========================================================================
    // OPERACIONES DE TARJETAS
    // ========================================================================

    /**
     * Asociar tarjeta tokenizada al cliente
     */
    async asociarTarjeta(customerId, tokenId, deviceSessionId, auditContext = {}) {
        try {
            this._checkRateLimit();
            await this.ensureInitialized();

            const sanitizedCustomerId = sanitizeString(customerId, 100);
            const sanitizedTokenId = sanitizeString(tokenId, 100);
            const sanitizedDeviceSessionId = sanitizeString(deviceSessionId, 100);

            if (!sanitizedCustomerId || !sanitizedTokenId || !sanitizedDeviceSessionId) {
                throw new Error('Datos incompletos para asociar tarjeta');
            }

            secureLogger.info('Asociando tarjeta a cliente', { customerId: sanitizedCustomerId });

            const cardData = {
                token_id: sanitizedTokenId,
                device_session_id: sanitizedDeviceSessionId
            };

            const response = await this._executeWithLogging(
                () => this.axiosInstance.post(`/customers/${sanitizedCustomerId}/cards`, cardData),
                {
                    metodohttp: 'POST',
                    endpoint: `/customers/${sanitizedCustomerId}/cards`,
                    operacion: 'ASSOCIATE_CARD',
                    bodyenviado: cardData,
                    auditContext
                }
            );

            if (response.data && response.data.id) {
                return {
                    success: true,
                    tarjeta: {
                        id: response.data.id,
                        type: response.data.type,
                        brand: response.data.brand,
                        card_number: response.data.card_number,
                        holder_name: response.data.holder_name,
                        expiration_year: response.data.expiration_year,
                        expiration_month: response.data.expiration_month,
                        bank_name: response.data.bank_name,
                        bank_code: response.data.bank_code
                    },
                    idapilog: response._idapilog // Agregar idapilog para trazabilidad
                };
            }

            throw new Error('Respuesta inválida al asociar tarjeta');

        } catch (error) {
            secureLogger.error('Error al asociar tarjeta', error);

            return {
                success: false,
                error: error.response?.data?.description || 'Error al asociar tarjeta',
                code: error.response?.data?.error_code || 'UNKNOWN_ERROR',
                idapilog: error._idapilog
            };
        }
    }

    /**
     * Guardar tarjeta en tabla local PasarelaTarjeta
     */
    async guardarTarjetaLocal(data) {
        try {
            await this.ensureInitialized();

            const idclipas = parseInt(data.idclipas, 10);
            if (isNaN(idclipas) || idclipas < 1) {
                throw new Error('ID de cliente pasarela inválido');
            }

            await sequelize.query(
                `INSERT INTO PasarelaTarjeta (
                    idclipas, sourceid, ultimos4, anioexp, mesexp, 
                    nomtitular, tipotarjeta, bancoemisor, idapilog, estado, feccre
                ) VALUES (
                    :idclipas, :sourceid, :ultimos4, :anioexp, :mesexp, 
                    :nomtitular, :tipotarjeta, :bancoemisor, :idapilog, 'S', GETDATE()
                )`,
                {
                    replacements: {
                        idclipas,
                        sourceid: sanitizeString(data.idtarjext || data.sourceid, 100),
                        ultimos4: sanitizeString(data.ultimos4, 4),
                        anioexp: sanitizeString(data.anioexp, 4),
                        mesexp: sanitizeString(data.mesexp, 2),
                        nomtitular: sanitizeString(data.holdername || data.nomtitular, 150),
                        tipotarjeta: sanitizeString(data.marca || data.tipotarjeta, 20),
                        bancoemisor: sanitizeString(data.banco || data.bancoemisor, 100),
                        idapilog: data.idapilog || null
                    },
                    type: QueryTypes.INSERT
                }
            );

            // Obtener ID insertado
            const insertedTarjeta = await sequelize.query(
                `SELECT TOP 1 idtarjpas FROM PasarelaTarjeta 
                 WHERE idclipas = :idclipas ORDER BY idtarjpas DESC`,
                {
                    replacements: { idclipas },
                    type: QueryTypes.SELECT
                }
            );

            secureLogger.info('Tarjeta local guardada', { idtarjpas: insertedTarjeta[0]?.idtarjpas, idapilog: data.idapilog });

            // Registrar auditoría
            await this._registrarAuditoria({
                tablaafectada: 'PasarelaTarjeta',
                idregistro: insertedTarjeta[0]?.idtarjpas,
                accion: 'INSERT',
                camposcambiados: {
                    idclipas,
                    ultimos4: data.ultimos4,
                    tipotarjeta: data.marca || data.tipotarjeta,
                    idapilog: data.idapilog
                }
            });

            return { success: true, idtarjpas: insertedTarjeta[0]?.idtarjpas };

        } catch (error) {
            secureLogger.error('Error al guardar tarjeta local', error);
            return { success: false, error: 'Error al guardar tarjeta' };
        }
    }

    // ========================================================================
    // OPERACIONES DE SUSCRIPCIONES
    // ========================================================================

    /**
     * Crear suscripción en OpenPay
     */
    async crearSuscripcion(customerId, planId, cardId, auditContext = {}) {
        try {
            this._checkRateLimit();
            await this.ensureInitialized();

            const sanitizedCustomerId = sanitizeString(customerId, 100);
            const sanitizedPlanId = sanitizeString(planId, 100);
            const sanitizedCardId = sanitizeString(cardId, 100);

            if (!sanitizedCustomerId || !sanitizedPlanId) {
                throw new Error('Datos incompletos para crear suscripción');
            }

            const idempotencyKey = generateIdempotencyKey({
                operation: 'CREATE_SUBSCRIPTION',
                customerId: sanitizedCustomerId,
                planId: sanitizedPlanId
            });

            const cachedResult = this._checkIdempotency(idempotencyKey);
            if (cachedResult) {
                secureLogger.info('Retornando resultado cacheado para crearSuscripcion');
                return cachedResult.result;
            }

            secureLogger.info('Creando suscripción', { customerId: sanitizedCustomerId, planId: sanitizedPlanId });

            const subscriptionData = {
                plan_id: sanitizedPlanId
            };

            if (sanitizedCardId) {
                subscriptionData.source_id = sanitizedCardId;
            }

            const response = await this._executeWithLogging(
                () => this.axiosInstance.post(`/customers/${sanitizedCustomerId}/subscriptions`, subscriptionData),
                {
                    metodohttp: 'POST',
                    endpoint: `/customers/${sanitizedCustomerId}/subscriptions`,
                    operacion: 'CREATE_SUBSCRIPTION',
                    bodyenviado: subscriptionData,
                    auditContext
                }
            );

            if (response.data && response.data.id) {
                const result = {
                    success: true,
                    suscripcion: {
                        id: response.data.id,
                        status: response.data.status,
                        charge_date: response.data.charge_date,
                        creation_date: response.data.creation_date,
                        current_period_number: response.data.current_period_number,
                        period_end_date: response.data.period_end_date,
                        trial_end_date: response.data.trial_end_date,
                        plan_id: response.data.plan_id,
                        customer_id: response.data.customer_id,
                        card: response.data.card
                    },
                    idapilog: response._idapilog // Agregar idapilog para trazabilidad
                };

                this._registerOperation(idempotencyKey, result);
                secureLogger.info('Suscripción creada exitosamente', { subscriptionId: response.data.id, idapilog: response._idapilog });
                return result;
            }

            throw new Error('Respuesta inválida al crear suscripción');

        } catch (error) {
            secureLogger.error('Error al crear suscripción', error);

            return {
                success: false,
                error: error.response?.data?.description || 'Error al crear suscripción',
                code: error.response?.data?.error_code || 'UNKNOWN_ERROR',
                idapilog: error._idapilog
            };
        }
    }

    /**
     * Obtener suscripción de OpenPay
     */
    async obtenerSuscripcion(customerId, subscriptionId) {
        try {
            this._checkRateLimit();
            await this.ensureInitialized();

            const sanitizedCustomerId = sanitizeString(customerId, 100);
            const sanitizedSubscriptionId = sanitizeString(subscriptionId, 100);

            if (!sanitizedCustomerId || !sanitizedSubscriptionId) {
                throw new Error('IDs inválidos');
            }

            const response = await this._executeWithLogging(
                () => this.axiosInstance.get(`/customers/${sanitizedCustomerId}/subscriptions/${sanitizedSubscriptionId}`),
                {
                    metodohttp: 'GET',
                    endpoint: `/customers/${sanitizedCustomerId}/subscriptions/${sanitizedSubscriptionId}`,
                    operacion: 'GET_SUBSCRIPTION',
                    bodyenviado: null,
                    auditContext: {}
                }
            );

            if (response.data && response.data.id) {
                return {
                    success: true,
                    suscripcion: response.data
                };
            }

            throw new Error('Respuesta inválida');

        } catch (error) {
            secureLogger.error('Error al obtener suscripción', error);

            if (error.response?.status === 404) {
                return { success: false, error: 'Suscripción no encontrada', code: 'NOT_FOUND' };
            }

            return {
                success: false,
                error: error.response?.data?.description || 'Error al obtener suscripción',
                code: error.response?.data?.error_code || 'UNKNOWN_ERROR'
            };
        }
    }

    /**
     * Cancelar suscripción en OpenPay
     */
    async cancelarSuscripcion(customerId, subscriptionId) {
        try {
            this._checkRateLimit();
            await this.ensureInitialized();

            const sanitizedCustomerId = sanitizeString(customerId, 100);
            const sanitizedSubscriptionId = sanitizeString(subscriptionId, 100);

            if (!sanitizedCustomerId || !sanitizedSubscriptionId) {
                throw new Error('IDs inválidos para cancelar suscripción');
            }

            secureLogger.info('Cancelando suscripción', {
                customerId: sanitizedCustomerId,
                subscriptionId: sanitizedSubscriptionId
            });

            await this._executeWithLogging(
                () => this.axiosInstance.delete(`/customers/${sanitizedCustomerId}/subscriptions/${sanitizedSubscriptionId}`),
                {
                    metodohttp: 'DELETE',
                    endpoint: `/customers/${sanitizedCustomerId}/subscriptions/${sanitizedSubscriptionId}`,
                    operacion: 'CANCEL_SUBSCRIPTION',
                    bodyenviado: null,
                    auditContext: {}
                }
            );

            secureLogger.info('Suscripción cancelada');
            return { success: true };

        } catch (error) {
            secureLogger.error('Error al cancelar suscripción', error);

            return {
                success: false,
                error: error.response?.data?.description || 'Error al cancelar suscripción',
                code: error.response?.data?.error_code || 'UNKNOWN_ERROR'
            };
        }
    }

    /**
     * Guardar suscripción en tabla local PasarelaSuscripcion
     */
    async guardarSuscripcionLocal(data) {
        try {
            await this.ensureInitialized();

            const idclipas = parseInt(data.idclipas, 10);
            const idplanpas = parseInt(data.idplanpas, 10);
            const idtarjpas = data.idtarjpas ? parseInt(data.idtarjpas, 10) : null;

            if (isNaN(idclipas) || idclipas < 1 || isNaN(idplanpas) || idplanpas < 1) {
                throw new Error('IDs de cliente o plan inválidos');
            }

            // Validar que idtarjpas no sea NULL (la tabla lo requiere)
            if (!idtarjpas) {
                throw new Error('ID de tarjeta es requerido para guardar la suscripción');
            }

            // Convertir fechas ISO a formato SQL Server (YYYY-MM-DD HH:MM:SS)
            const formatDateForSQL = (dateStr) => {
                if (!dateStr) return null;
                try {
                    const date = new Date(dateStr);
                    return date.toISOString().slice(0, 19).replace('T', ' ');
                } catch {
                    return null;
                }
            };

            await sequelize.query(
                `INSERT INTO PasarelaSuscripcion (
                    idclipas, idplanpas, idtarjpas, idsuscext, estsuscripcion, 
                    fecinicio, fecfinperiodo, fecproximocobro, idusu, idapilog, feccre
                ) VALUES (
                    :idclipas, :idplanpas, :idtarjpas, :idsuscext, :estsuscripcion, 
                    COALESCE(TRY_CONVERT(DATETIME, :fecinicio), GETDATE()), 
                    TRY_CONVERT(DATE, :fecfinperiodo), 
                    TRY_CONVERT(DATE, :fecproximocobro), 
                    :idusu, :idapilog, GETDATE()
                )`,
                {
                    replacements: {
                        idclipas,
                        idplanpas,
                        idtarjpas,
                        idsuscext: sanitizeString(data.idsuscext, 100),
                        estsuscripcion: sanitizeString(data.estsuscripcion || 'S', 1),
                        fecinicio: formatDateForSQL(data.fecinicio),
                        fecfinperiodo: data.fecfinperiodo ? data.fecfinperiodo.split('T')[0] : null,
                        fecproximocobro: data.fecproximocobro ? data.fecproximocobro.split('T')[0] : null,
                        idusu: data.idusu ? parseInt(data.idusu, 10) : null,
                        idapilog: data.idapilog || null
                    },
                    type: QueryTypes.INSERT
                }
            );

            // Obtener ID insertado
            const insertedSuscripcion = await sequelize.query(
                `SELECT TOP 1 idsuscpas FROM PasarelaSuscripcion 
                 WHERE idclipas = :idclipas ORDER BY idsuscpas DESC`,
                {
                    replacements: { idclipas },
                    type: QueryTypes.SELECT
                }
            );

            secureLogger.info('Suscripción local guardada', { idsuscpas: insertedSuscripcion[0]?.idsuscpas, idapilog: data.idapilog });

            // Registrar auditoría
            await this._registrarAuditoria({
                tablaafectada: 'PasarelaSuscripcion',
                idregistro: insertedSuscripcion[0]?.idsuscpas,
                accion: 'INSERT',
                camposcambiados: {
                    idclipas,
                    idplanpas,
                    idtarjpas,
                    idsuscext: data.idsuscext,
                    estsuscripcion: data.estsuscripcion,
                    idapilog: data.idapilog
                },
                idusu: data.idusu
            });

            return { success: true, idsuscpas: insertedSuscripcion[0]?.idsuscpas };

        } catch (error) {
            secureLogger.error('Error al guardar suscripción local', error);
            return { success: false, error: 'Error al guardar suscripción' };
        }
    }

    /**
     * Obtener suscripciones activas del cliente
     */
    async obtenerSuscripcionesCliente(idusu) {
        try {
            await this.ensureInitialized();

            const validatedIdusu = parseInt(idusu, 10);
            if (isNaN(validatedIdusu) || validatedIdusu < 1) {
                return { success: false, suscripciones: [] };
            }

            const result = await sequelize.query(
                `SELECT ps.idsuscpas, ps.idsuscext, ps.idplanpas, pp.nomplanext,
                        pp.precio, pp.frecuencianum, pp.frecuenciaunidad,
                        ps.estsuscripcion, ps.fecinicio, ps.fecfinperiodo,
                        ps.fecproximocobro
                 FROM PasarelaSuscripcion ps
                 INNER JOIN PasarelaPlan pp ON ps.idplanpas = pp.idplanpas
                 INNER JOIN PasarelaCliente pc ON ps.idclipas = pc.idclipas
                 WHERE pc.idusu = :idusu 
                   AND ps.estsuscripcion = 'S'
                 ORDER BY ps.feccre DESC`,
                {
                    replacements: { idusu: validatedIdusu },
                    type: QueryTypes.SELECT
                }
            );

            return {
                success: true,
                suscripciones: result,
                tieneSuscripcionActiva: result.length > 0
            };

        } catch (error) {
            secureLogger.error('Error al obtener suscripciones del cliente', error);
            return { success: false, suscripciones: [], error: error.message };
        }
    }

    // ========================================================================
    // OPERACIONES DE PLANES
    // ========================================================================

    /**
     * Obtener plan de OpenPay
     */
    async obtenerPlan(planId) {
        try {
            this._checkRateLimit();
            await this.ensureInitialized();

            const sanitizedPlanId = sanitizeString(planId, 100);
            if (!sanitizedPlanId) {
                throw new Error('ID de plan inválido');
            }

            const response = await this._executeWithLogging(
                () => this.axiosInstance.get(`/plans/${sanitizedPlanId}`),
                {
                    metodohttp: 'GET',
                    endpoint: `/plans/${sanitizedPlanId}`,
                    operacion: 'GET_PLAN',
                    bodyenviado: null,
                    auditContext: {}
                }
            );

            if (response.data && response.data.id) {
                return {
                    success: true,
                    plan: response.data
                };
            }

            throw new Error('Respuesta inválida');

        } catch (error) {
            secureLogger.error('Error al obtener plan', error);

            if (error.response?.status === 404) {
                return { success: false, error: 'Plan no encontrado', code: 'NOT_FOUND' };
            }

            return {
                success: false,
                error: error.response?.data?.description || 'Error al obtener plan',
                code: error.response?.data?.error_code || 'UNKNOWN_ERROR'
            };
        }
    }

    /**
     * Obtener plan de la tabla local
     */
    async obtenerPlanLocal(idplanpas) {
        try {
            await this.ensureInitialized();

            const validatedId = parseInt(idplanpas, 10);
            if (isNaN(validatedId) || validatedId < 1) {
                return null;
            }

            const result = await sequelize.query(
                `SELECT pp.idplanpas, pp.codplanext, pp.nomplanext, pp.precio, 
                        pp.moneda, pp.frecuencianum, pp.frecuenciaunidad, pp.diasprueba,
                        p.idpro, p.barcpro, p.despro, p.durpro
                 FROM PasarelaPlan pp
                 INNER JOIN Producto p ON pp.barcpro = p.barcpro
                 WHERE pp.idplanpas = :idplanpas AND pp.estado = 'S'`,
                {
                    replacements: { idplanpas: validatedId },
                    type: QueryTypes.SELECT
                }
            );

            return result.length > 0 ? result[0] : null;

        } catch (error) {
            secureLogger.error('Error al obtener plan local', error);
            return null;
        }
    }

    // ========================================================================
    // OPERACIONES DE CARGOS (PAGOS ÚNICOS)
    // ========================================================================

    /**
     * Crear cargo (pago único) en OpenPay
     * @param {Object} chargeData - Datos del cargo
     * @param {boolean} chargeData.use_3d_secure - Si usar 3D Secure (opcional)
     * @param {string} chargeData.redirect_url - URL de redirección para 3D Secure (requerida si use_3d_secure=true)
     */
    async crearCargo(chargeData) {
        try {
            this._checkRateLimit();
            await this.ensureInitialized();

            const validatedData = {
                method: 'card',
                amount: validateAmount(chargeData.amount),
                currency: chargeData.currency || this.config.moneda || 'PEN',
                description: sanitizeString(chargeData.description || 'Pago ModoFit', 250)
            };

            if (chargeData.source_id) {
                validatedData.source_id = sanitizeString(chargeData.source_id, 100);
            }

            if (chargeData.device_session_id) {
                validatedData.device_session_id = sanitizeString(chargeData.device_session_id, 100);
            }

            // Soporte para 3D Secure
            if (chargeData.use_3d_secure) {
                validatedData.use_3d_secure = true;
                if (chargeData.redirect_url) {
                    validatedData.redirect_url = chargeData.redirect_url;
                } else {
                    throw new Error('redirect_url es requerida cuando use_3d_secure está activo');
                }
            }

            // Order ID para seguimiento
            if (chargeData.order_id) {
                validatedData.order_id = sanitizeString(chargeData.order_id, 100);
            }

            if (chargeData.customer) {
                validatedData.customer = {
                    name: sanitizeString(chargeData.customer.name, 100),
                    last_name: sanitizeString(chargeData.customer.last_name, 100),
                    email: chargeData.customer.email?.trim().toLowerCase(),
                    phone_number: chargeData.customer.phone_number?.replace(/[^0-9]/g, '').substring(0, 15)
                };
            }

            secureLogger.info('Creando cargo', { amount: validatedData.amount, use_3d_secure: !!chargeData.use_3d_secure });

            const response = await this._executeWithLogging(
                () => this.axiosInstance.post('/charges', validatedData),
                {
                    metodohttp: 'POST',
                    endpoint: '/charges',
                    operacion: 'CREATE_CHARGE',
                    bodyenviado: validatedData,
                    auditContext: {}
                }
            );

            if (response.data && response.data.id) {
                const result = {
                    success: true,
                    cargo: {
                        id: response.data.id,
                        status: response.data.status,
                        authorization: response.data.authorization,
                        amount: response.data.amount,
                        currency: response.data.currency,
                        operation_type: response.data.operation_type,
                        creation_date: response.data.creation_date,
                        order_id: response.data.order_id
                    }
                };

                // Si es 3D Secure, agregar información de redirección
                if (response.data.payment_method && response.data.payment_method.url) {
                    result.requires_3d_secure = true;
                    result.redirect_url = response.data.payment_method.url;
                    result.cargo.payment_method = response.data.payment_method;
                }

                return result;
            }

            throw new Error('Respuesta inválida al crear cargo');

        } catch (error) {
            secureLogger.error('Error al crear cargo', error);

            return {
                success: false,
                error: error.response?.data?.description || 'Error al procesar el pago',
                code: error.response?.data?.error_code || 'UNKNOWN_ERROR'
            };
        }
    }

    /**
     * Crear cargo con 3D Secure
     * Crea un cargo que requiere autenticación 3D Secure del banco
     */
    async crearCargo3DSecure(chargeData, redirectUrl) {
        return this.crearCargo({
            ...chargeData,
            use_3d_secure: true,
            redirect_url: redirectUrl
        });
    }

    /**
     * Obtener estado de un cargo (útil después de 3D Secure redirect)
     */
    async obtenerCargo(chargeId) {
        try {
            this._checkRateLimit();
            await this.ensureInitialized();

            const sanitizedId = sanitizeString(chargeId, 100);
            if (!sanitizedId) {
                throw new Error('ID de cargo inválido');
            }

            secureLogger.info('Obteniendo cargo', { chargeId: sanitizedId });

            const response = await this._executeWithLogging(
                () => this.axiosInstance.get(`/charges/${sanitizedId}`),
                {
                    metodohttp: 'GET',
                    endpoint: `/charges/${sanitizedId}`,
                    operacion: 'GET_CHARGE',
                    bodyenviado: null,
                    auditContext: {}
                }
            );

            if (response.data && response.data.id) {
                return {
                    success: true,
                    cargo: {
                        id: response.data.id,
                        status: response.data.status,
                        authorization: response.data.authorization,
                        amount: response.data.amount,
                        currency: response.data.currency,
                        operation_type: response.data.operation_type,
                        creation_date: response.data.creation_date,
                        order_id: response.data.order_id,
                        error_message: response.data.error_message,
                        card: response.data.card
                    }
                };
            }

            throw new Error('Respuesta inválida');

        } catch (error) {
            secureLogger.error('Error al obtener cargo', error);

            if (error.response?.status === 404) {
                return { success: false, error: 'Cargo no encontrado', code: 'NOT_FOUND' };
            }

            return {
                success: false,
                error: error.response?.data?.description || 'Error al obtener cargo',
                code: error.response?.data?.error_code || 'UNKNOWN_ERROR'
            };
        }
    }

    // ========================================================================
    // UTILIDADES
    // ========================================================================

    getConfigInfo() {
        if (!this.config) {
            return { initialized: false };
        }
        return {
            initialized: true,
            ambiente: this.config.ambiente,
            moneda: this.config.moneda,
            idpasarela: this.config.idpasarela,
            lastInitTime: this._lastInitTime ? new Date(this._lastInitTime).toISOString() : null,
            rateLimitRemaining: Math.max(0, SECURITY_CONFIG.RATE_LIMIT_MAX_REQUESTS - this._requestCount)
        };
    }

    async healthCheck() {
        try {
            await this.ensureInitialized();
            return {
                status: 'healthy',
                initialized: true,
                ambiente: this.config.ambiente,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                initialized: false,
                error: 'Error de conexión con servicio de pagos',
                timestamp: new Date().toISOString()
            };
        }
    }
}

// Crear instancia singleton
const openpayServiceInstance = new OpenPayService();

// Exportar instancia y utilidades
module.exports = openpayServiceInstance;
module.exports.AuditContext = AuditContext;
module.exports.sanitizeString = sanitizeString;
module.exports.validateAmount = validateAmount;
module.exports.maskSensitiveData = maskSensitiveData;
