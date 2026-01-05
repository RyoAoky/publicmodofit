/**
 * Controller SQL para ModoFit Public
 * Maneja la lógica de negocio para el proceso de pago con OpenPay
 * 
 * FLUJO COMPLETO CORREGIDO (20 PASOS):
 * 
 * === FASE 0: SESIÓN (PRIMERO - Antes de todo) ===
 * Paso 1: Crear registro en PasarelaSesion (genera sessionid y devicesessionid)
 * Paso 2: Registrar en PasarelaSesionHistorial: acción 'INICIO'
 * 
 * === FASE 1: CLIENTE ===
 * Paso 3: Buscar usuario por documento en tabla usuario
 * Paso 4: Buscar en PasarelaCliente (por idusu o dniusu) con estado='S'
 * Paso 5: Si NO existe usuario → crear usuario
 * Paso 6: Crear cliente en OpenPay (ApiLog inicio → OpenPay → ApiLog respuesta → Auditoria)
 * Paso 7: Registrar en PasarelaCliente con idapilog
 * 
 * === FASE 2: TARJETA ===
 * Paso 8: Asociar tarjeta en OpenPay (ApiLog → OpenPay → ApiLog → Auditoria)
 * Paso 9: Guardar token en PasarelaTarjeta (vincular con idclipas + idapilog)
 * Paso 10: Registrar historial: acción 'TOKEN_CREADO'
 * 
 * === FASE 3: SUSCRIPCIÓN ===
 * Paso 11: Suscribir cliente en OpenPay (ApiLog → OpenPay → ApiLog → Auditoria)
 * Paso 12: Registrar en PasarelaSuscripcion con idapilog
 * 
 * === FASE 4: TRANSACCIÓN Y CIERRE ===
 * Paso 13: Registrar en PasarelaTransaccion con idapilog
 * Paso 14: Actualizar Caja (tipocaja='V') + CajaDetallePasarela
 * Paso 15: Registrar historial: acción 'PAGO_EXITOSO' o 'PAGO_FALLIDO'
 * Paso 16: Cerrar sesión (actualizar estado a 'C'=Completada o 'F'=Fallida)
 * 
 * === FASE 5: VENTA Y MEMBRESÍA ===
 * Paso 17: Crear Venta virtual (origenventa='V', idcaja, idtranspas)
 * Paso 18: Crear VentaDetalle
 * Paso 19: Crear Membresía con estado='S' (Activa), idsuscpas
 * Paso 20: Actualizar PasarelaTransaccion con idven
 * 
 * NOTA: Todos los pagos son por pasarela (suscripciones). No hay pagos al contado.
 */


const { sequelize } = require('../database/conexionsqualize');
const { QueryTypes } = require('sequelize');
const openpayService = require('../services/openpayService');
const { AuditContext, sanitizeString } = require('../services/openpayService');

// ============================================================================
// PASO 3: BUSCAR USUARIO POR DOCUMENTO
// ============================================================================

/**
 * Buscar usuario por DNI/Documento en tabla usuario
 * @param {string} numeroDocumento - DNI o documento del cliente
 * @returns {Object|null} - Datos del usuario o null si no existe
 */
async function buscarUsuarioPorDocumento(numeroDocumento) {
    const dni = sanitizeString(numeroDocumento, 15);
    if (!dni) {
        console.log('[Paso 3] Documento vacío o inválido');
        return null;
    }

    console.log(`[Paso 3] Buscando usuario con documento: ${dni}`);

    const resultado = await sequelize.query(
        `SELECT idusu, nomusu, apellusu, mailusu, contacusu, dniusu, estusu--, tipodoc
         FROM usuario 
         WHERE dniusu = :dni`,
        {
            replacements: { dni },
            type: QueryTypes.SELECT
        }
    );

    if (resultado.length > 0) {
        console.log(`[Paso 3] Usuario encontrado: idusu=${resultado[0].idusu}, nombre=${resultado[0].nomusu}`);
        return resultado[0];
    }

    console.log('[Paso 3] Usuario NO encontrado en tabla usuario');
    return null;
}

// ============================================================================
// PASO 4: BUSCAR CLIENTE EN PASARELACLIENTE
// ============================================================================

/**
 * Buscar cliente en tabla PasarelaCliente por idusu o dniusu con estado='S'
 * @param {number} idusu - ID del usuario (puede ser null)
 * @param {string} dniusu - DNI del usuario
 * @returns {Object|null} - Datos del cliente pasarela o null si no existe
 */
async function buscarClientePasarela(idusu, dniusu) {
    const dni = sanitizeString(dniusu, 15);

    console.log(`[Paso 4] Buscando en PasarelaCliente: idusu=${idusu}, dniusu=${dni}`);

    // Buscar por idusu O por dniusu, con estado='S' (activo)
    const resultado = await sequelize.query(
        `SELECT pc.idclipas, pc.idpasarela, pc.idusu, pc.dniusu, 
                pc.idcliext, pc.emailregistrado, pc.telefonoregistrado,
                pc.estado, pc.feccre, pc.fecmov
         FROM PasarelaCliente pc
         WHERE (pc.idusu = :idusu OR pc.dniusu = :dniusu) 
           AND pc.estado = 'S'`,
        {
            replacements: {
                idusu: idusu || 0,
                dniusu: dni
            },
            type: QueryTypes.SELECT
        }
    );

    if (resultado.length > 0) {
        console.log(`[Paso 4] Cliente encontrado en PasarelaCliente: idclipas=${resultado[0].idclipas}, idcliext=${resultado[0].idcliext}`);
        return resultado[0];
    }

    console.log('[Paso 4] Cliente NO encontrado en PasarelaCliente');
    return null;
}

// ============================================================================
// PASO 5: CREAR USUARIO EN TABLA USUARIO
// ============================================================================

/**
 * Crear nuevo usuario en tabla usuario
 * @param {Object} datosCliente - Datos del cliente desde el formulario
 * @returns {Object} - Usuario creado con idusu
 */
async function crearUsuario(datosCliente) {
    const { nombre, apellido, email, telefono, numeroDocumento, tipoDocumento } = datosCliente;

    // Sanitizar datos
    const nombreLimpio = sanitizeString(nombre, 50);
    const apellidoLimpio = sanitizeString(apellido, 50);
    const dniLimpio = sanitizeString(numeroDocumento, 15);
    const emailLimpio = email?.trim().toLowerCase() || '';
    const telefonoLimpio = telefono?.replace(/[^0-9]/g, '') || '';

    console.log(`[Paso 5] Creando usuario: ${nombreLimpio} ${apellidoLimpio}, DNI: ${dniLimpio}`);

    const result = await sequelize.query(
        `INSERT INTO usuario (
            nomusu, apellusu, dniusu, tipodoc, passusu, fecnacusu, 
            contacusu, mailusu, estusu, estintrausu, codgen, idrol, feccre
        )
        OUTPUT INSERTED.idusu, INSERTED.nomusu, INSERTED.apellusu, INSERTED.mailusu, INSERTED.dniusu, INSERTED.contacusu
        VALUES (
            :nombre, :apellido, :dni, :tipodoc, '', '1990-01-01', 
            :telefono, :email, 'S', 'N', 'O', 3, GETDATE()
        )`,
        {
            replacements: {
                nombre: nombreLimpio,
                apellido: apellidoLimpio,
                dni: dniLimpio,
                tipodoc: tipoDocumento || 'DNI',
                telefono: telefonoLimpio,
                email: emailLimpio
            },
            type: QueryTypes.INSERT
        }
    );

    const usuarioCreado = result[0]?.[0] || null;

    if (usuarioCreado) {
        console.log(`[Paso 5] Usuario creado exitosamente: idusu=${usuarioCreado.idusu}`);
    } else {
        console.log('[Paso 5] ERROR: No se pudo crear el usuario');
    }

    return usuarioCreado;
}

// ============================================================================
// PASO 6: CREAR CLIENTE EN OPENPAY
// ============================================================================

/**
 * Crear cliente en OpenPay
 * 
 * FLUJO INTERNO (manejado por openpayService._executeWithLogging):
 * 1. Registrar INICIO en PasarelaApiLog (obtener idapilog)
 * 2. Llamar a OpenPay API
 * 3. Actualizar PasarelaApiLog con la respuesta
 * 4. Registrar en PasarelaAuditoria
 * 5. Retornar { success, cliente, idapilog }
 * 
 * @param {Object} usuario - Datos del usuario de la BD
 * @param {Object} datosCliente - Datos adicionales del formulario
 * @param {Object} auditContext - Contexto de auditoría (IP, userAgent, etc)
 * @returns {Object} - { success, cliente, idapilog, error }
 */
async function crearClienteEnOpenpay(usuario, datosCliente, auditContext = {}) {
    console.log(`[Paso 6] Creando cliente en OpenPay para usuario: ${usuario.idusu}`);
    console.log('[Paso 6] FLUJO: ApiLog(inicio) → OpenPay API → ApiLog(respuesta) → Auditoria');

    const clienteOpenPay = {
        name: datosCliente.nombre || usuario.nomusu,
        last_name: datosCliente.apellido || usuario.apellusu,
        email: datosCliente.email || usuario.mailusu,
        phone_number: datosCliente.telefono || usuario.contacusu,
        external_id: `${usuario.dniusu}`
    };

    console.log('[Paso 4] Datos a enviar a OpenPay:', JSON.stringify(clienteOpenPay, null, 2));

    // Llamar al servicio OpenPay 
    // Internamente hace: ApiLog(inicio) → OpenPay → ApiLog(respuesta) → Auditoria
    const resultado = await openpayService.crearCliente(clienteOpenPay, auditContext);

    if (resultado.success) {
        console.log(`[Paso 6] ✓ Cliente creado en OpenPay: id=${resultado.cliente.id}`);
        console.log(`[Paso 6] ✓ ApiLog registrado con idapilog=${resultado.idapilog}`);
        console.log(`[Paso 6] ✓ Auditoria registrada`);
    } else {
        console.log(`[Paso 6] ✗ ERROR al crear cliente en OpenPay: ${resultado.error}`);
        console.log(`[Paso 6] ✓ ApiLog registrado con error, idapilog=${resultado.idapilog}`);
    }

    return resultado;
}

// ============================================================================
// PASO 7: REGISTRAR EN PASARELACLIENTE (con idapilog de paso 6)
// ============================================================================

/**
 * Registrar cliente en tabla PasarelaCliente
 * Este paso usa el idapilog obtenido del paso 6 (llamada a OpenPay)
 * 
 * @param {Object} datos - Datos para insertar
 * @returns {Object} - { success, idclipas }
 */
async function registrarClientePasarela(datos) {
    const { idusu, dniusu, idcliext, email, telefono, idapilog } = datos;

    console.log(`[Paso 7] Registrando en PasarelaCliente:`);
    console.log(`[Paso 7]   - idusu: ${idusu}`);
    console.log(`[Paso 7]   - dniusu: ${dniusu}`);
    console.log(`[Paso 7]   - idcliext (OpenPay): ${idcliext}`);
    console.log(`[Paso 7]   - idapilog (del paso 6): ${idapilog}`);

    try {
        // Obtener idpasarela de OpenPay
        await openpayService.ensureInitialized();
        const idpasarela = openpayService.config?.idpasarela || 1;

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
                    idpasarela,
                    idusu,
                    dniusu: sanitizeString(dniusu, 15),
                    idcliext: sanitizeString(idcliext, 100),
                    email: email || null,
                    telefono: telefono || null,
                    idapilog: idapilog || null
                },
                type: QueryTypes.INSERT
            }
        );

        // Obtener ID insertado
        const result = await sequelize.query(
            `SELECT TOP 1 idclipas FROM PasarelaCliente 
             WHERE idusu = :idusu AND idpasarela = :idpasarela 
             ORDER BY idclipas DESC`,
            {
                replacements: { idusu, idpasarela },
                type: QueryTypes.SELECT
            }
        );

        const idclipas = result[0]?.idclipas;
        console.log(`[Paso 7] ✓ Cliente registrado en PasarelaCliente: idclipas=${idclipas}`);
        console.log(`[Paso 7] ✓ Vinculado con idapilog=${idapilog}`);

        return { success: true, idclipas };

    } catch (error) {
        console.log(`[Paso 7] ✗ ERROR al registrar en PasarelaCliente: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// PASO 8: ASOCIAR TARJETA EN OPENPAY
// ============================================================================

/**
 * Asociar tarjeta tokenizada al cliente en OpenPay
 * 
 * FLUJO INTERNO:
 * 1. Registrar INICIO en PasarelaApiLog → obtener idapilog
 * 2. Llamar a OpenPay POST /customers/{id}/cards
 * 3. Actualizar PasarelaApiLog con respuesta
 * 4. Registrar en PasarelaAuditoria
 * 
 * @param {string} idcliext - ID del cliente en OpenPay (cus_xxxxx)
 * @param {string} tokenId - Token de la tarjeta generado por OpenPay.js
 * @param {string} deviceSessionId - Device session ID para antifraude
 * @param {Object} auditContext - Contexto de auditoría
 * @returns {Object} - { success, tarjeta, idapilog, error }
 */
async function asociarTarjetaEnOpenpay(idcliext, tokenId, deviceSessionId, auditContext = {}) {
    console.log(`[Paso 8] Asociando tarjeta en OpenPay para cliente: ${idcliext}`);
    console.log('[Paso 8] FLUJO: ApiLog(inicio) → OpenPay API → ApiLog(respuesta) → Auditoria');

    const resultado = await openpayService.asociarTarjeta(idcliext, tokenId, deviceSessionId, auditContext);

    if (resultado.success) {
        console.log(`[Paso 8] ✓ Tarjeta asociada en OpenPay: id=${resultado.tarjeta.id}`);
        console.log(`[Paso 8] ✓ Marca: ${resultado.tarjeta.brand}, Últimos 4: ****${resultado.tarjeta.card_number?.slice(-4)}`);
        console.log(`[Paso 8] ✓ ApiLog registrado con idapilog=${resultado.idapilog}`);
    } else {
        console.log(`[Paso 8] ✗ ERROR al asociar tarjeta: ${resultado.error}`);
    }

    return resultado;
}

// ============================================================================
// PASO 9: GUARDAR TARJETA EN PASARELATARJETA (con idapilog del paso 8)
// ============================================================================

/**
 * Guardar token de tarjeta en PasarelaTarjeta
 * Vincula con idclipas obtenido del paso 7 e idapilog del paso 8
 * 
 * Campos de PasarelaTarjeta:
 * - idtarjpas (IDENTITY)
 * - idclipas (FK a PasarelaCliente)
 * - idmarcatarj (FK opcional)
 * - idapilog (FK a PasarelaApiLog) ← NUEVO
 * - tokenidtemp, sourceid, devicesessionid
 * - ultimos4, mesexp, anioexp, nomtitular, tipotarjeta
 * - bin, bancoemisor, paisemisor, categoriatarjeta, fingerprint
 * - espredeterminada, estado, feccre, fecmov
 * 
 * @param {Object} datos - Datos de la tarjeta
 * @returns {Object} - { success, idtarjpas }
 */
async function guardarTarjetaPasarela(datos) {
    const {
        idclipas, tokenId, sourceid, deviceSessionId,
        ultimos4, mesexp, anioexp, nomtitular, marca,
        bancoemisor, idapilog
    } = datos;

    console.log(`[Paso 9] Guardando tarjeta en PasarelaTarjeta:`);
    console.log(`[Paso 9]   - idclipas: ${idclipas}`);
    console.log(`[Paso 9]   - sourceid (card_id): ${sourceid}`);
    console.log(`[Paso 9]   - marca: ${marca}, ultimos4: ****${ultimos4}`);
    console.log(`[Paso 9]   - idapilog (del paso 8): ${idapilog}`);

    try {
        await sequelize.query(
            `INSERT INTO PasarelaTarjeta (
                idclipas, idapilog, tokenidtemp, sourceid, devicesessionid,
                ultimos4, mesexp, anioexp, nomtitular, tipotarjeta,
                bancoemisor, espredeterminada, estado, feccre
            ) VALUES (
                :idclipas, :idapilog, :tokenidtemp, :sourceid, :devicesessionid,
                :ultimos4, :mesexp, :anioexp, :nomtitular, :tipotarjeta,
                :bancoemisor, 'S', 'S', GETDATE()
            )`,
            {
                replacements: {
                    idclipas,
                    idapilog: idapilog || null,
                    tokenidtemp: sanitizeString(tokenId, 100),
                    sourceid: sanitizeString(sourceid, 100),
                    devicesessionid: sanitizeString(deviceSessionId, 150),
                    ultimos4: sanitizeString(ultimos4, 4),
                    mesexp: sanitizeString(mesexp, 2),
                    anioexp: sanitizeString(anioexp, 4),
                    nomtitular: sanitizeString(nomtitular, 150),
                    tipotarjeta: sanitizeString(marca, 20),
                    bancoemisor: sanitizeString(bancoemisor, 100)
                },
                type: QueryTypes.INSERT
            }
        );

        // Obtener ID insertado
        const result = await sequelize.query(
            `SELECT TOP 1 idtarjpas FROM PasarelaTarjeta 
             WHERE idclipas = :idclipas ORDER BY idtarjpas DESC`,
            {
                replacements: { idclipas },
                type: QueryTypes.SELECT
            }
        );

        const idtarjpas = result[0]?.idtarjpas;
        console.log(`[Paso 9] ✓ Tarjeta guardada en PasarelaTarjeta: idtarjpas=${idtarjpas}`);
        console.log(`[Paso 9] ✓ Vinculada con idapilog=${idapilog}`);

        return { success: true, idtarjpas };

    } catch (error) {
        console.log(`[Paso 9] ✗ ERROR al guardar tarjeta: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// PASO 1: CREAR SESIÓN EN PASARELASESION (PRIMERO - Antes de todo)
// ============================================================================

/**
 * Crear registro de sesión de pago - ES EL PRIMER PASO DEL FLUJO
 * Se debe crear ANTES de procesar cliente, tarjeta, etc.
 * 
 * Campos de PasarelaSesion:
 * - idsesionpas (IDENTITY)
 * - idpasarela, idusu, dniusu
 * - sessionid, devicesessionid
 * - useragent, ipaddress, plataforma, navegador, sistemaoperativo
 * - idven, barcpro, montintentado
 * - estsesion (S=Activa, C=Completada, E=Expirada, F=Fallida)
 * - fecinicio, fecultactividad, fecexpiracion, fecfin
 * - intentospago, idtranspas
 * 
 * @param {Object} datos - Datos de la sesión
 * @returns {Object} - { success, idsesionpas, sessionid, devicesessionid }
 */
async function crearSesionPago(datos) {
    const {
        idusu, dniusu, deviceSessionId,
        useragent, ipaddress, plataforma,
        barcpro, montintentado
    } = datos;

    console.log(`[Paso 1] Creando sesión de pago en PasarelaSesion:`);
    console.log(`[Paso 1]   - idusu: ${idusu || 'pendiente'}`);
    console.log(`[Paso 1]   - dniusu: ${dniusu}`);
    console.log(`[Paso 1]   - monto: ${montintentado}`);

    try {
        await openpayService.ensureInitialized();
        const idpasarela = openpayService.config?.idpasarela || 1;

        // Generar sessionid único
        const sessionid = `SES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        await sequelize.query(
            `INSERT INTO PasarelaSesion (
                idpasarela, idusu, dniusu, sessionid, devicesessionid,
                useragent, ipaddress, plataforma, barcpro, montintentado,
                estsesion, fecinicio, fecultactividad, fecexpiracion, intentospago
            ) VALUES (
                :idpasarela, :idusu, :dniusu, :sessionid, :devicesessionid,
                :useragent, :ipaddress, :plataforma, :barcpro, :montintentado,
                'S', GETDATE(), GETDATE(), DATEADD(HOUR, 1, GETDATE()), 0
            )`,
            {
                replacements: {
                    idpasarela,
                    idusu,
                    dniusu: sanitizeString(dniusu, 10),
                    sessionid,
                    devicesessionid: sanitizeString(deviceSessionId, 150),
                    useragent: sanitizeString(useragent, 500),
                    ipaddress: sanitizeString(ipaddress, 45),
                    plataforma: sanitizeString(plataforma || 'WEB', 50),
                    barcpro: sanitizeString(barcpro, 100),
                    montintentado: montintentado || null
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
        console.log(`[Paso 1] ✓ Sesión creada: idsesionpas=${idsesionpas}, sessionid=${sessionid}`);

        return { success: true, idsesionpas, sessionid, devicesessionid: sanitizeString(deviceSessionId, 150) };

    } catch (error) {
        console.log(`[Paso 1] ✗ ERROR al crear sesión: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// PASO 2: REGISTRAR EN PASARELASESIONHISTORIAL (Acción INICIO)
// ============================================================================

/**
 * Registrar acción en historial de sesión
 * Se llama inmediatamente después de crear la sesión (Paso 1) con acción 'INICIO'
 * 
 * Campos de PasarelaSesionHistorial:
 * - idsesionhist (IDENTITY)
 * - idsesionpas (FK)
 * - accion: 'INICIO', 'TOKEN_CREADO', 'PAGO_INTENTO', 'PAGO_EXITOSO', 'PAGO_FALLIDO', 'EXPIRACION'
 * - detalleaccion
 * - ipaddress, datosadicionales
 * - fecaccion
 * 
 * @param {number} idsesionpas - ID de la sesión
 * @param {string} accion - Tipo de acción
 * @param {string} detalle - Descripción de la acción
 * @param {string} ipaddress - IP del cliente
 * @param {Object} datosAdicionales - Datos extra en JSON
 * @returns {Object} - { success }
 */
async function registrarHistorialSesion(idsesionpas, accion, detalle, ipaddress = null, datosAdicionales = null) {
    console.log(`[Paso 2/10/15] Registrando en PasarelaSesionHistorial:`);
    console.log(`[Historial]   - idsesionpas: ${idsesionpas}`);
    console.log(`[Historial]   - accion: ${accion}`);
    console.log(`[Historial]   - detalle: ${detalle}`);

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
                    datosadicionales: datosAdicionales ? JSON.stringify(datosAdicionales) : null
                },
                type: QueryTypes.INSERT
            }
        );

        console.log(`[Historial] ✓ Historial registrado: ${accion}`);
        return { success: true };

    } catch (error) {
        console.log(`[Historial] ✗ ERROR al registrar historial: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// PASO 11: SUSCRIBIR CLIENTE EN OPENPAY
// ============================================================================

/**
 * Crear suscripción en OpenPay
 * 
 * FLUJO INTERNO:
 * 1. Registrar INICIO en PasarelaApiLog → obtener idapilog
 * 2. Llamar a OpenPay POST /customers/{id}/subscriptions
 * 3. Actualizar PasarelaApiLog con respuesta
 * 4. Registrar en PasarelaAuditoria
 * 
 * @param {string} idcliext - ID del cliente en OpenPay
 * @param {string} planId - ID del plan en OpenPay (pln_xxxxx)
 * @param {string} cardId - ID de la tarjeta en OpenPay (opcional)
 * @param {Object} auditContext - Contexto de auditoría
 * @returns {Object} - { success, suscripcion, idapilog, error }
 */
async function suscribirClienteEnOpenpay(idcliext, planId, cardId, auditContext = {}) {
    console.log(`[Paso 11] Creando suscripción en OpenPay:`);
    console.log(`[Paso 11]   - idcliext: ${idcliext}`);
    console.log(`[Paso 11]   - planId: ${planId}`);
    console.log(`[Paso 11]   - cardId: ${cardId}`);
    console.log('[Paso 11] FLUJO: ApiLog(inicio) → OpenPay API → ApiLog(respuesta) → Auditoria');

    const resultado = await openpayService.crearSuscripcion(idcliext, planId, cardId, auditContext);

    if (resultado.success) {
        console.log(`[Paso 11] ✓ Suscripción creada en OpenPay: id=${resultado.suscripcion.id}`);
        console.log(`[Paso 11] ✓ Status: ${resultado.suscripcion.status}`);
        console.log(`[Paso 11] ✓ ApiLog registrado con idapilog=${resultado.idapilog}`);
    } else {
        console.log(`[Paso 11] ✗ ERROR al crear suscripción: ${resultado.error}`);
    }

    return resultado;
}

// ============================================================================
// PASO 12: REGISTRAR EN PASARELASUSCRIPCION (con idapilog del paso 11)
// ============================================================================

/**
 * Guardar suscripción en PasarelaSuscripcion
 * 
 * Campos de PasarelaSuscripcion:
 * - idsuscpas (IDENTITY)
 * - idclipas (FK), idplanpas (FK), idtarjpas (FK)
 * - idsuscext (ID de OpenPay)
 * - fecinicio, fecproximocobro, feccancelacion, fecfinperiodo
 * - idestadopas (FK), estsuscripcion (S=Activa, P=Pausada, C=Cancelada, V=Vencida)
 * - idmem (FK a Membresía)
 * - cobrosrealizados, cobrosfallidos
 * - idusu, feccre, fecmov
 * 
 * @param {Object} datos - Datos de la suscripción
 * @returns {Object} - { success, idsuscpas }
 */
async function guardarSuscripcionPasarela(datos) {
    const {
        idclipas, idplanpas, idtarjpas, idsuscext,
        fecinicio, fecproximocobro, fecfinperiodo,
        idusu, idapilog
    } = datos;

    console.log(`[Paso 11] Guardando suscripción en PasarelaSuscripcion:`);
    console.log(`[Paso 11]   - idclipas: ${idclipas}`);
    console.log(`[Paso 11]   - idplanpas: ${idplanpas}`);
    console.log(`[Paso 11]   - idtarjpas: ${idtarjpas}`);
    console.log(`[Paso 11]   - idsuscext (OpenPay): ${idsuscext}`);
    console.log(`[Paso 12]   - idapilog (del paso 11): ${idapilog}`);

    try {
        // Convertir fechas ISO a formato SQL
        const formatDate = (dateStr) => {
            if (!dateStr) return null;
            try {
                return dateStr.split('T')[0]; // Solo fecha YYYY-MM-DD
            } catch {
                return null;
            }
        };

        await sequelize.query(
            `INSERT INTO PasarelaSuscripcion (
                idclipas, idplanpas, idtarjpas, idapilog, idsuscext,
                fecinicio, fecproximocobro, fecfinperiodo,
                estsuscripcion, cobrosrealizados, cobrosfallidos,
                idusu, feccre
            ) VALUES (
                :idclipas, :idplanpas, :idtarjpas, :idapilog, :idsuscext,
                COALESCE(TRY_CONVERT(DATETIME, :fecinicio), GETDATE()), 
                TRY_CONVERT(DATE, :fecproximocobro), 
                TRY_CONVERT(DATE, :fecfinperiodo),
                'S', 0, 0,
                :idusu, GETDATE()
            )`,
            {
                replacements: {
                    idclipas,
                    idplanpas,
                    idtarjpas,
                    idapilog: idapilog || null,
                    idsuscext: sanitizeString(idsuscext, 100),
                    fecinicio: formatDate(fecinicio),
                    fecproximocobro: formatDate(fecproximocobro),
                    fecfinperiodo: formatDate(fecfinperiodo),
                    idusu
                },
                type: QueryTypes.INSERT
            }
        );

        // Obtener ID insertado
        const result = await sequelize.query(
            `SELECT TOP 1 idsuscpas FROM PasarelaSuscripcion 
             WHERE idclipas = :idclipas ORDER BY idsuscpas DESC`,
            {
                replacements: { idclipas },
                type: QueryTypes.SELECT
            }
        );

        const idsuscpas = result[0]?.idsuscpas;
        console.log(`[Paso 12] ✓ Suscripción guardada: idsuscpas=${idsuscpas}`);
        console.log(`[Paso 12] ✓ Vinculada con idapilog=${idapilog}`);

        return { success: true, idsuscpas };

    } catch (error) {
        console.log(`[Paso 12] ✗ ERROR al guardar suscripción: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// PASO 13: REGISTRAR EN PASARELATRANSACCION (con idapilog)
// ============================================================================

/**
 * Registrar transacción en PasarelaTransaccion
 * 
 * Campos principales:
 * - idtranspas (IDENTITY)
 * - idpasarela, idcaja (tabla Caja unificada con tipocaja='V')
 * - idusu, dniusu, idven, idmem, idsuscpas, idsesionpas
 * - idapilog (FK a PasarelaApiLog) ← NUEVO
 * - idtransext, referenciaorden
 * - idtipotrans (FK), idestadopas (FK)
 * - moneda, montbruto, montcomisionvar, montcomisionfija, montimpuestocom, montneto
 * - idtarjpas, ultimos4tarj, marcatarj
 * - jsonresponse, coderrorpas, msgerrorpas
 * - ipaddress, useragent
 * - estado, fectransaccion, fecmov
 * 
 * @param {Object} datos - Datos de la transacción
 * @returns {Object} - { success, idtranspas }
 */
async function registrarTransaccion(datos) {
    const {
        idusu, dniusu, idsuscpas, idsesionpas, idtarjpas,
        idtransext, referenciaorden,
        tipotransaccion, estadoext,
        montbruto, montcomision, montimpuesto,
        ultimos4tarj, marcatarj,
        jsonresponse, ipaddress, useragent,
        idapilog
    } = datos;

    console.log(`[Paso 13] Registrando transacción en PasarelaTransaccion:`);
    console.log(`[Paso 13]   - idusu: ${idusu}`);
    console.log(`[Paso 13]   - idsuscpas: ${idsuscpas}`);
    console.log(`[Paso 13]   - idsesionpas: ${idsesionpas}`);
    console.log(`[Paso 13]   - idtransext: ${idtransext}`);
    console.log(`[Paso 13]   - montbruto: ${montbruto}`);
    console.log(`[Paso 13]   - idapilog (del paso 11): ${idapilog}`);

    try {
        await openpayService.ensureInitialized();
        const idpasarela = openpayService.config?.idpasarela || 1;

        // Obtener o crear caja virtual del día (ahora usa tabla Caja unificada)
        const cajaResult = await openpayService.obtenerOCrearCajaVirtual();
        const idcaja = cajaResult.cajaVirtual?.idcaja || cajaResult.cajaVirtual?.idcajavirtual || null;

        // Obtener estado de la pasarela
        const estadoResult = await sequelize.query(
            `SELECT TOP 1 idestadopas FROM PasarelaEstado 
             WHERE idpasarela = :idpasarela AND codestadoext = :codestado`,
            {
                replacements: { idpasarela, codestado: estadoext || 'in_progress' },
                type: QueryTypes.SELECT
            }
        );

        // Obtener tipo de transacción
        const tipoResult = await sequelize.query(
            `SELECT TOP 1 idtipotrans FROM PasarelaTipoTransaccion 
             WHERE codtipotrans = :codtipo`,
            {
                replacements: { codtipo: tipotransaccion || 'SUSCRIPCION' },
                type: QueryTypes.SELECT
            }
        );

        // Calcular montos
        const montcomisionvar = montcomision || 0;
        const montimpuestocom = montimpuesto || 0;
        const montneto = (montbruto || 0) - montcomisionvar - montimpuestocom;

        await sequelize.query(
            `INSERT INTO PasarelaTransaccion (
                idpasarela, idcaja, idusu, dniusu,
                idsuscpas, idsesionpas, idapilog, idtransext, referenciaorden,
                idtipotrans, idestadopas, montbruto, montcomisionvar,
                montimpuestocom, montneto, moneda, idtarjpas,
                ultimos4tarj, marcatarj, jsonresponse, 
                ipaddress, useragent, estado, fectransaccion
            ) VALUES (
                :idpasarela, :idcaja, :idusu, :dniusu,
                :idsuscpas, :idsesionpas, :idapilog, :idtransext, :referenciaorden,
                :idtipotrans, :idestadopas, :montbruto, :montcomisionvar,
                :montimpuestocom, :montneto, 'PEN', :idtarjpas,
                :ultimos4tarj, :marcatarj, :jsonresponse,
                :ipaddress, :useragent, 'S', GETDATE()
            )`,
            {
                replacements: {
                    idpasarela,
                    idcaja,
                    idusu,
                    dniusu: sanitizeString(dniusu, 10),
                    idsuscpas,
                    idsesionpas,
                    idapilog: idapilog || null,
                    idtransext: sanitizeString(idtransext, 100),
                    referenciaorden: sanitizeString(referenciaorden, 50),
                    idtipotrans: tipoResult[0]?.idtipotrans || 2, // 2 = SUSCRIPCION
                    idestadopas: estadoResult[0]?.idestadopas || 1,
                    montbruto: montbruto || 0,
                    montcomisionvar,
                    montimpuestocom,
                    montneto,
                    idtarjpas,
                    ultimos4tarj: sanitizeString(ultimos4tarj, 4),
                    marcatarj: sanitizeString(marcatarj, 20),
                    jsonresponse: jsonresponse ? JSON.stringify(jsonresponse) : null,
                    ipaddress: sanitizeString(ipaddress, 45),
                    useragent: sanitizeString(useragent, 500)
                },
                type: QueryTypes.INSERT
            }
        );

        // Obtener ID insertado
        const result = await sequelize.query(
            `SELECT TOP 1 idtranspas FROM PasarelaTransaccion 
             WHERE idpasarela = :idpasarela ORDER BY idtranspas DESC`,
            {
                replacements: { idpasarela },
                type: QueryTypes.SELECT
            }
        );

        const idtranspas = result[0]?.idtranspas;
        console.log(`[Paso 13] ✓ Transacción registrada: idtranspas=${idtranspas}`);
        console.log(`[Paso 13] ✓ Vinculada con idapilog=${idapilog}`);

        // Actualizar caja virtual si el cobro fue exitoso (Paso 14)
        if (estadoext === 'completed' || estadoext === 'active') {
            await openpayService.actualizarCajaVirtual(
                idcaja,
                montbruto || 0,
                montcomisionvar,
                montimpuestocom
            );
            console.log(`[Paso 14] ✓ Caja (tipocaja='V') actualizada`);
        }

        return { success: true, idtranspas };

    } catch (error) {
        console.log(`[Paso 13] ✗ ERROR al registrar transacción: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// PASO 15: REGISTRAR HISTORIAL PAGO_EXITOSO/PAGO_FALLIDO
// ============================================================================
// Ya cubierto por registrarHistorialSesion() con acción correspondiente

// ============================================================================
// PASO 16: CERRAR SESIÓN
// ============================================================================

/**
 * Cerrar sesión de pago (actualizar estado y fecha fin)
 * 
 * @param {number} idsesionpas - ID de la sesión
 * @param {string} estado - 'C'=Completada, 'F'=Fallida, 'E'=Expirada
 * @param {number} idtranspas - ID de la transacción (opcional)
 * @returns {Object} - { success }
 */
async function cerrarSesion(idsesionpas, estado = 'C', idtranspas = null) {
    console.log(`[Paso 16] Cerrando sesión: idsesionpas=${idsesionpas}, estado=${estado}`);

    try {
        await sequelize.query(
            `UPDATE PasarelaSesion SET 
                estsesion = :estado,
                fecfin = GETDATE(),
                fecultactividad = GETDATE(),
                idtranspas = COALESCE(:idtranspas, idtranspas)
             WHERE idsesionpas = :idsesionpas`,
            {
                replacements: { idsesionpas, estado, idtranspas },
                type: QueryTypes.UPDATE
            }
        );

        console.log(`[Paso 16] ✓ Sesión cerrada con estado=${estado}`);
        return { success: true };

    } catch (error) {
        console.log(`[Paso 16] ✗ ERROR al cerrar sesión: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// PASO 17: CREAR VENTA VIRTUAL
// ============================================================================

/**
 * Crear registro de Venta para transacción virtual
 * 
 * NOTA: Las ventas virtuales tienen:
 * - idcaja = ID de caja con tipocaja='V' (tabla Caja unificada)
 * - origenventa = 'V' (Virtual)
 * - codtipopago = 'TR' (TARJETA)
 * 
 * @param {Object} datos - Datos de la venta
 * @returns {Object} - { success, idven }
 */
async function crearVentaVirtual(datos) {
    const {
        dniusu, idcaja, idtranspas,
        subtotal, descuento, total,
        idusuven
    } = datos;

    console.log(`[Paso 17] Creando Venta virtual:`);
    console.log(`[Paso 17]   - dniusu: ${dniusu}`);
    console.log(`[Paso 17]   - idcaja: ${idcaja} (tipocaja='V')`);
    console.log(`[Paso 17]   - idtranspas: ${idtranspas}`);
    console.log(`[Paso 17]   - total: ${total}`);

    try {
        const resultventa = await sequelize.query(
            `INSERT INTO Venta (
                dniusu, codtipopago, subtotalven, descven, totalven,
                cantpagven, cambioven, estven, feccre, idusuven,
                idcaja, idtranspas, origenventa
            ) 
            OUTPUT INSERTED.idven
            VALUES (
                :dniusu, 'TR', :subtotal, :descuento, :total,
                :total, 0, 'S', GETDATE(), :idusuven,
                :idcaja, :idtranspas, 'V'
            )`,
            {
                replacements: {
                    dniusu: sanitizeString(dniusu, 20),
                    subtotal: subtotal || 0,
                    descuento: descuento || 0,
                    total: total || 0,
                    idusuven: idusuven || 0,
                    idcaja,
                    idtranspas
                },
                type: QueryTypes.INSERT
            }
        );
        
        const idVentaCreada = resultventa[0]?.idven;

        //en mi tabla ventapagos se debe insertar lo siguiente idvenpago	idven	codtipopago	monto	feccre	cambio
        await sequelize.query(
            `INSERT INTO VentaPagos (
               idven, codtipopago, monto, feccre, cambio
            ) VALUES (
                :idven, 'TR', :total, GETDATE(), 0
            )`,
            {
                replacements: {
                    idven: idVentaCreada,
                    total: total || 0,
                },
                type: QueryTypes.INSERT
            }
        );

        // Obtener ID insertado (aunque ya lo tenemos, mantenemos lógica de retorno consistente)
        const idven = idVentaCreada;
        console.log(`[Paso 17] ✓ Venta virtual creada: idven=${idven}`);

        return { success: true, idven };

    } catch (error) {
        console.log(`[Paso 17] ✗ ERROR al crear venta virtual: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// PASO 18: CREAR VENTA DETALLE
// ============================================================================

/**
 * Crear registro de VentaDetalle para la membresía
 * 
 * @param {Object} datos - Datos del detalle
 * @returns {Object} - { success, idvendet }
 */
async function crearVentaDetalle(datos) {
    const {
        idven, barcpro, cantidad, cospro, fecini, subtotal, dniusucli, idusuven
    } = datos;

    console.log(`[Paso 18] Creando VentaDetalle:`);
    console.log(`[Paso 18]   - idven: ${idven}`);
    console.log(`[Paso 18]   - barcpro: ${barcpro}`);
    console.log(`[Paso 18]   - cospro: ${cospro}`);

    try {
        await sequelize.query(
            `INSERT INTO VentaDetalle (
                idven, barcpro, cantvendet, cospro, fecini, subtotal, dniusucli, feccre, idusuven
            ) VALUES (
                :idven, :barcpro, :cantidad, :cospro, GETDATE(), :subtotal, :dniusucli, GETDATE(), :idusuven
            )`,
            {
                replacements: {
                    idven,
                    barcpro: sanitizeString(barcpro, 100),
                    cantidad: cantidad || 1,
                    cospro: cospro || 0,
                    subtotal: subtotal || cospro,
                    dniusucli: sanitizeString(dniusucli, 20),
                    idusuven: idusuven || 0
                },
                type: QueryTypes.INSERT
            }
        );

        // Obtener ID insertado
        const result = await sequelize.query(
            `SELECT TOP 1 idvendet FROM VentaDetalle 
             WHERE idven = :idven ORDER BY idvendet DESC`,
            {
                replacements: { idven },
                type: QueryTypes.SELECT
            }
        );

        const idvendet = result[0]?.idvendet;
        console.log(`[Paso 18] ✓ VentaDetalle creado: idvendet=${idvendet}`);

        return { success: true, idvendet };

    } catch (error) {
        console.log(`[Paso 18] ✗ ERROR al crear venta detalle: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// PASO 19: CREAR MEMBRESÍA
// ============================================================================

/**
 * Crear registro de Membresía
 * 
 * Estados de membresía:
 * - S = Activa
 * - V = Vencida
 * - C = Cancelada
 * - P = Pendiente
 * 
 * @param {Object} datos - Datos de la membresía
 * @returns {Object} - { success, idmem }
 */
async function crearMembresia(datos) {
    const {
        idusu, dniusu, barcpro, idven, idsuscpas,
        diasmem, fechaInicio, fechaFin
    } = datos;

    console.log(`[Paso 19] Creando Membresía:`);
    console.log(`[Paso 19]   - idusu: ${idusu}`);
    console.log(`[Paso 19]   - dniusu: ${dniusu}`);
    console.log(`[Paso 19]   - barcpro: ${barcpro}`);
    console.log(`[Paso 19]   - idven: ${idven}`);
    console.log(`[Paso 19]   - idsuscpas: ${idsuscpas}`);
    console.log(`[Paso 19]   - diasmem: ${diasmem}`);

    try {
        // Obtener datos del producto para tipo de membresía
        const producto = await sequelize.query(
            `SELECT 1 as idtipomem, durpro as diasproducto FROM Producto WHERE barcpro = :barcpro`,
            {
                replacements: { barcpro },
                type: QueryTypes.SELECT
            }
        );

        const idtipomem = producto[0]?.idtipomem || 1;
        const diasProducto = diasmem || producto[0]?.diasproducto || 30;

        await sequelize.query(
            `INSERT INTO Membresia (
                fecinimem, fecfinmem, diasmem, diasstock, ingmem,
                idtipomem, dniusutit, barcpro, feccre, idusumem,
                estamem, codsta, fecmv, idven, estado_deuda, idsuscpas
            ) VALUES (
                COALESCE(TRY_CONVERT(DATE, :fechaInicio), GETDATE()),
                COALESCE(TRY_CONVERT(DATE, :fechaFin), DATEADD(DAY, :diasmem, GETDATE())),
                :diasmem, :diasmem, 0,
                :idtipomem, :dniusu, :barcpro, GETDATE(), :idusu,
                'S', 'A', GETDATE(), :idven, 'N', :idsuscpas
            )`,
            {
                replacements: {
                    fechaInicio,
                    fechaFin,
                    diasmem: diasProducto,
                    idtipomem,
                    dniusu: sanitizeString(dniusu, 20),
                    barcpro: sanitizeString(barcpro, 50),
                    idusu,
                    idven,
                    idsuscpas
                },
                type: QueryTypes.INSERT
            }
        );

        // Obtener ID insertado
        const result = await sequelize.query(
            `SELECT TOP 1 idmem FROM Membresia 
             WHERE idven = :idven ORDER BY idmem DESC`,
            {
                replacements: { idven },
                type: QueryTypes.SELECT
            }
        );

        const idmem = result[0]?.idmem;
        console.log(`[Paso 19] ✓ Membresía creada: idmem=${idmem}, estado=S (Activa)`);

        // Actualizar PasarelaSuscripcion con el idmem
        if (idsuscpas && idmem) {
            await sequelize.query(
                `UPDATE PasarelaSuscripcion SET idmem = :idmem, fecmov = GETDATE() 
                 WHERE idsuscpas = :idsuscpas`,
                {
                    replacements: { idmem, idsuscpas },
                    type: QueryTypes.UPDATE
                }
            );
            console.log(`[Paso 19] ✓ PasarelaSuscripcion actualizada con idmem=${idmem}`);
        }

        return { success: true, idmem };

    } catch (error) {
        console.log(`[Paso 19] ✗ ERROR al crear membresía: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// PASO 20: ACTUALIZAR TRANSACCIÓN CON IDVEN
// ============================================================================

/**
 * Actualizar PasarelaTransaccion con el idven
 * 
 * @param {number} idtranspas - ID de la transacción
 * @param {number} idven - ID de la venta
 * @returns {Object} - { success }
 */
async function actualizarTransaccionConVenta(idtranspas, idven) {
    console.log(`[Paso 20] Vinculando transacción ${idtranspas} con venta ${idven}`);

    try {
        await sequelize.query(
            `UPDATE PasarelaTransaccion SET idven = :idven, fecmov = GETDATE() 
             WHERE idtranspas = :idtranspas`,
            {
                replacements: { idven, idtranspas },
                type: QueryTypes.UPDATE
            }
        );

        console.log(`[Paso 20] ✓ Transacción vinculada con venta`);
        return { success: true };

    } catch (error) {
        console.log(`[Paso 20] ✗ ERROR: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// FLUJO PRINCIPAL: PROCESAR CLIENTE (PASOS 3-7)
// ============================================================================

/**
 * Flujo para procesar cliente (Pasos 3-7)
 * Se llama DESPUÉS de crear la sesión (Pasos 1-2)
 * 
 * FLUJO:
 * 3. Buscar usuario por documento
 * 4. Buscar en PasarelaCliente
 * 5. Si NO existe usuario → crear usuario
 * 6. Crear cliente en OpenPay (ApiLog → OpenPay → ApiLog → Auditoria)
 * 7. Registrar en PasarelaCliente con idapilog
 * 
 * @param {Object} datosCliente - Datos del formulario de checkout
 * @param {Object} auditContext - Contexto de auditoría
 * @returns {Object} - { success, usuario, clientePasarela, clienteOpenpay, esNuevo, error }
 */
async function procesarCliente(datosCliente, auditContext = {}) {
    const { numeroDocumento, nombre, apellido, email, telefono } = datosCliente;

    console.log('='.repeat(60));
    console.log('[FLUJO CLIENTE] Iniciando procesamiento de cliente (Pasos 3-7)');
    console.log(`[FLUJO CLIENTE] Documento: ${numeroDocumento}`);
    console.log('='.repeat(60));

    try {
        // ----------------------------------------------------------------
        // PASO 3: Buscar usuario por documento
        // ----------------------------------------------------------------
        let usuario = await buscarUsuarioPorDocumento(numeroDocumento);
        let usuarioEsNuevo = false;

        // ----------------------------------------------------------------
        // PASO 4: Si existe usuario, buscar en PasarelaCliente
        // ----------------------------------------------------------------
        if (usuario) {
            console.log('[FLUJO CLIENTE] Usuario existe, buscando en PasarelaCliente...');

            const clientePasarela = await buscarClientePasarela(usuario.idusu, usuario.dniusu);

            if (clientePasarela && clientePasarela.idcliext) {
                // Ya existe en PasarelaCliente con estado='S'
                console.log('[FLUJO CLIENTE] Cliente ya existe en PasarelaCliente, retornando datos existentes');
                console.log('='.repeat(60));

                return {
                    success: true,
                    usuario,
                    clientePasarela,
                    clienteOpenpay: { id: clientePasarela.idcliext },
                    esNuevo: false,
                    mensaje: 'Cliente existente recuperado'
                };
            }

            // Usuario existe pero NO está en PasarelaCliente
            console.log('[FLUJO CLIENTE] Usuario existe pero NO está en PasarelaCliente, creando en OpenPay...');

        } else {
            // ----------------------------------------------------------------
            // PASO 5: Usuario NO existe, crear nuevo usuario
            // ----------------------------------------------------------------
            console.log('[FLUJO CLIENTE] Usuario NO existe, creando nuevo usuario...');

            usuario = await crearUsuario(datosCliente);

            if (!usuario) {
                throw new Error('No se pudo crear el usuario en la base de datos');
            }

            usuarioEsNuevo = true;
        }

        // ----------------------------------------------------------------
        // PASO 6: Crear cliente en OpenPay (registra automáticamente en ApiLog)
        // ----------------------------------------------------------------
        const resultadoOpenpay = await crearClienteEnOpenpay(usuario, datosCliente, auditContext);

        if (!resultadoOpenpay.success) {
            throw new Error(resultadoOpenpay.error || 'Error al crear cliente en OpenPay');
        }

        // ----------------------------------------------------------------
        // PASO 7: Registrar en PasarelaCliente con el idapilog
        // ----------------------------------------------------------------
        const resultadoPasarela = await registrarClientePasarela({
            idusu: usuario.idusu,
            dniusu: usuario.dniusu,
            idcliext: resultadoOpenpay.cliente.id,
            email: datosCliente.email || usuario.mailusu,
            telefono: datosCliente.telefono || usuario.contacusu,
            idapilog: resultadoOpenpay.idapilog
        });

        if (!resultadoPasarela.success) {
            throw new Error(resultadoPasarela.error || 'Error al registrar en PasarelaCliente');
        }

        console.log('[FLUJO CLIENTE] Proceso completado exitosamente');
        console.log('='.repeat(60));

        return {
            success: true,
            usuario,
            clientePasarela: {
                idclipas: resultadoPasarela.idclipas,
                idcliext: resultadoOpenpay.cliente.id,
                idapilog: resultadoOpenpay.idapilog
            },
            clienteOpenpay: resultadoOpenpay.cliente,
            esNuevo: true,
            usuarioEsNuevo,
            mensaje: usuarioEsNuevo ? 'Usuario y cliente creados' : 'Cliente creado para usuario existente'
        };

    } catch (error) {
        console.log(`[FLUJO CLIENTE] ERROR: ${error.message}`);
        console.log('='.repeat(60));

        return {
            success: false,
            error: error.message,
            mensaje: 'Error al procesar cliente'
        };
    }
}

// ============================================================================
// FLUJO COMPLETO: PROCESAR PAGO COMPLETO (16 PASOS)
// ============================================================================

/**
 * Flujo completo para procesar un pago de suscripción
 * Orquesta los 16 pasos del proceso de pago
 * 
 * @param {Object} datos - Todos los datos necesarios para el pago
 * @param {Object} auditContext - Contexto de auditoría (IP, userAgent, etc)
 * @returns {Object} - Resultado completo del proceso
 */
async function procesarPagoCompleto(datos, auditContext = {}) {
    const {
        // Datos del cliente
        datosCliente,
        // Datos de la tarjeta (token de OpenPay.js)
        tokenTarjeta,
        deviceSessionId,
        // Datos del plan/suscripción
        planId,      // ID del plan en OpenPay (pln_xxxxx)
        idplanpas,   // ID del plan en nuestra BD
        montoPlan,
        barcpro      // Código del producto
    } = datos;

    console.log('');
    console.log('#'.repeat(60));
    console.log('# INICIANDO FLUJO COMPLETO DE PAGO - 16 PASOS');
    console.log('#'.repeat(60));
    console.log(`# Cliente: ${datosCliente.nombre} ${datosCliente.apellido}`);
    console.log(`# DNI: ${datosCliente.numeroDocumento}`);
    console.log(`# Plan: ${planId}`);
    console.log(`# Monto: S/ ${montoPlan}`);
    console.log('#'.repeat(60));
    console.log('');

    let sesion = null;
    let clienteResult = null;
    let tarjetaResult = null;
    let suscripcionResult = null;
    let transaccionResult = null;

    try {
        // ================================================================
        // FASE 0: SESIÓN (PASOS 1-2)
        // ================================================================
        console.log('\n>>> FASE 0: SESIÓN <<<');

        // PASO 1: Crear sesión de pago
        sesion = await crearSesionPago({
            idusu: null, // Aún no sabemos el idusu
            dniusu: datosCliente.numeroDocumento,
            deviceSessionId,
            useragent: auditContext.useragent,
            ipaddress: auditContext.ipaddress,
            plataforma: 'WEB',
            barcpro,
            montintentado: montoPlan
        });

        if (!sesion.success) {
            throw new Error(`Paso 1 falló: ${sesion.error}`);
        }

        // PASO 2: Registrar historial INICIO
        await registrarHistorialSesion(
            sesion.idsesionpas,
            'INICIO',
            'Inicio del proceso de pago',
            auditContext.ipaddress,
            { deviceSessionId, planId }
        );

        // ================================================================
        // FASE 1: CLIENTE (PASOS 3-7)
        // ================================================================
        console.log('\n>>> FASE 1: CLIENTE <<<');

        clienteResult = await procesarCliente(datosCliente, auditContext);

        if (!clienteResult.success) {
            throw new Error(`Fase Cliente falló: ${clienteResult.error}`);
        }

        // Actualizar sesión con idusu ahora que lo conocemos
        await sequelize.query(
            `UPDATE PasarelaSesion SET idusu = :idusu, fecultactividad = GETDATE() 
             WHERE idsesionpas = :idsesionpas`,
            {
                replacements: {
                    idusu: clienteResult.usuario.idusu,
                    idsesionpas: sesion.idsesionpas
                },
                type: QueryTypes.UPDATE
            }
        );

        // ================================================================
        // FASE 2: TARJETA (PASOS 8-10)
        // ================================================================
        console.log('\n>>> FASE 2: TARJETA <<<');

        // PASO 8: Asociar tarjeta en OpenPay
        const tarjetaOpenpay = await asociarTarjetaEnOpenpay(
            clienteResult.clientePasarela.idcliext,
            tokenTarjeta,
            deviceSessionId,
            { ...auditContext, idusu: clienteResult.usuario.idusu }
        );

        if (!tarjetaOpenpay.success) {
            throw new Error(`Paso 8 falló: ${tarjetaOpenpay.error}`);
        }

        // PASO 9: Guardar tarjeta en PasarelaTarjeta
        tarjetaResult = await guardarTarjetaPasarela({
            idclipas: clienteResult.clientePasarela.idclipas,
            tokenId: tokenTarjeta,
            sourceid: tarjetaOpenpay.tarjeta.id,
            deviceSessionId,
            ultimos4: tarjetaOpenpay.tarjeta.card_number?.slice(-4),
            mesexp: tarjetaOpenpay.tarjeta.expiration_month,
            anioexp: tarjetaOpenpay.tarjeta.expiration_year,
            nomtitular: tarjetaOpenpay.tarjeta.holder_name,
            marca: tarjetaOpenpay.tarjeta.brand,
            bancoemisor: tarjetaOpenpay.tarjeta.bank_name,
            idapilog: tarjetaOpenpay.idapilog
        });

        if (!tarjetaResult.success) {
            throw new Error(`Paso 9 falló: ${tarjetaResult.error}`);
        }

        // PASO 10: Registrar historial TOKEN_CREADO
        await registrarHistorialSesion(
            sesion.idsesionpas,
            'TOKEN_CREADO',
            `Tarjeta asociada: ****${tarjetaOpenpay.tarjeta.card_number?.slice(-4)} ${tarjetaOpenpay.tarjeta.brand}`,
            auditContext.ipaddress,
            { cardId: tarjetaOpenpay.tarjeta.id }
        );

        // ================================================================
        // FASE 3: SUSCRIPCIÓN (PASOS 11-12)
        // ================================================================
        console.log('\n>>> FASE 3: SUSCRIPCIÓN <<<');

        // PASO 11: Crear suscripción en OpenPay
        const suscripcionOpenpay = await suscribirClienteEnOpenpay(
            clienteResult.clientePasarela.idcliext,
            planId,
            tarjetaOpenpay.tarjeta.id,
            { ...auditContext, idusu: clienteResult.usuario.idusu }
        );

        if (!suscripcionOpenpay.success) {
            throw new Error(`Paso 11 falló: ${suscripcionOpenpay.error}`);
        }

        // PASO 12: Guardar suscripción en PasarelaSuscripcion
        suscripcionResult = await guardarSuscripcionPasarela({
            idclipas: clienteResult.clientePasarela.idclipas,
            idplanpas,
            idtarjpas: tarjetaResult.idtarjpas,
            idsuscext: suscripcionOpenpay.suscripcion.id,
            fecinicio: suscripcionOpenpay.suscripcion.creation_date,
            fecproximocobro: suscripcionOpenpay.suscripcion.charge_date,
            fecfinperiodo: suscripcionOpenpay.suscripcion.period_end_date,
            idusu: clienteResult.usuario.idusu,
            idapilog: suscripcionOpenpay.idapilog
        });

        if (!suscripcionResult.success) {
            throw new Error(`Paso 12 falló: ${suscripcionResult.error}`);
        }

        // ================================================================
        // FASE 4: TRANSACCIÓN Y CIERRE (PASOS 13-16)
        // ================================================================
        console.log('\n>>> FASE 4: TRANSACCIÓN Y CIERRE <<<');

        // PASO 13: Registrar transacción
        transaccionResult = await registrarTransaccion({
            idusu: clienteResult.usuario.idusu,
            dniusu: datosCliente.numeroDocumento,
            idsuscpas: suscripcionResult.idsuscpas,
            idsesionpas: sesion.idsesionpas,
            idtarjpas: tarjetaResult.idtarjpas,
            idtransext: suscripcionOpenpay.suscripcion.id,
            referenciaorden: `ORD-${Date.now()}`,
            tipotransaccion: 'SUSCRIPCION',
            estadoext: suscripcionOpenpay.suscripcion.status,
            montbruto: montoPlan,
            ultimos4tarj: tarjetaOpenpay.tarjeta.card_number?.slice(-4),
            marcatarj: tarjetaOpenpay.tarjeta.brand,
            jsonresponse: suscripcionOpenpay.suscripcion,
            ipaddress: auditContext.ipaddress,
            useragent: auditContext.useragent,
            idapilog: suscripcionOpenpay.idapilog
        });

        // PASO 14: CajaVirtual se actualiza dentro de registrarTransaccion

        // PASO 15: Registrar historial PAGO_EXITOSO
        await registrarHistorialSesion(
            sesion.idsesionpas,
            'PAGO_EXITOSO',
            `Suscripción creada: ${suscripcionOpenpay.suscripcion.id}`,
            auditContext.ipaddress,
            {
                idsuscpas: suscripcionResult.idsuscpas,
                idtranspas: transaccionResult.idtranspas
            }
        );

        // PASO 16: Cerrar sesión como Completada
        await cerrarSesion(sesion.idsesionpas, 'C', transaccionResult.idtranspas);

        // ================================================================
        // FASE 5: VENTA Y MEMBRESÍA (PASOS 17-20)
        // ================================================================
        console.log('\n>>> FASE 5: VENTA Y MEMBRESÍA <<<');

        // Obtener Caja virtual del día (tabla Caja unificada con tipocaja='V')
        const cajaResult = await openpayService.obtenerOCrearCajaVirtual();
        const idcaja = cajaResult.cajaVirtual?.idcaja || cajaResult.cajaVirtual?.idcajavirtual || null;

        // PASO 17: Crear Venta virtual
        const ventaResult = await crearVentaVirtual({
            dniusu: datosCliente.numeroDocumento,
            idcaja,
            idtranspas: transaccionResult.idtranspas,
            subtotal: montoPlan,
            descuento: 0,
            total: montoPlan,
            idusuven: clienteResult.usuario.idusu
        });

        if (!ventaResult.success) {
            console.log(`[ADVERTENCIA] No se pudo crear la venta: ${ventaResult.error}`);
            // No lanzar error, continuar con lo que tenemos
        }

        let ventaDetalleResult = null;
        let membresiaResult = null;

        if (ventaResult.success && ventaResult.idven) {
            // PASO 18: Crear VentaDetalle
            ventaDetalleResult = await crearVentaDetalle({
                idven: ventaResult.idven,
                barcpro,
                cantidad: 1,
                cospro: montoPlan,
                subtotal: montoPlan,
                dniusucli: datosCliente.numeroDocumento,
                idusuven: clienteResult.usuario.idusu
            });

            // PASO 19: Crear Membresía con estado='S' (Activa)
            membresiaResult = await crearMembresia({
                idusu: clienteResult.usuario.idusu,
                dniusu: datosCliente.numeroDocumento,
                barcpro,
                idven: ventaResult.idven,
                idsuscpas: suscripcionResult.idsuscpas,
                diasmem: datos.diasmem || null,
                fechaInicio: datos.fechaInicio || null,
                fechaFin: datos.fechaFin || null
            });

            // PASO 20: Actualizar transacción con idven
            await actualizarTransaccionConVenta(
                transaccionResult.idtranspas,
                ventaResult.idven
            );
        }

        // ================================================================
        // RESULTADO EXITOSO
        // ================================================================
        console.log('');
        console.log('#'.repeat(60));
        console.log('# ✓ FLUJO COMPLETADO EXITOSAMENTE - 20 PASOS');
        console.log('#'.repeat(60));
        console.log(`# Sesión: ${sesion.idsesionpas}`);
        console.log(`# Cliente OpenPay: ${clienteResult.clientePasarela.idcliext}`);
        console.log(`# Tarjeta: ****${tarjetaOpenpay.tarjeta.card_number?.slice(-4)}`);
        console.log(`# Suscripción OpenPay: ${suscripcionOpenpay.suscripcion.id}`);
        console.log(`# Transacción: ${transaccionResult.idtranspas}`);
        console.log(`# Venta: ${ventaResult?.idven || 'N/A'}`);
        console.log(`# Membresía: ${membresiaResult?.idmem || 'N/A'} (estado=S)`);
        console.log('#'.repeat(60));

        return {
            success: true,
            mensaje: 'Pago procesado exitosamente',
            datos: {
                sesion: {
                    idsesionpas: sesion.idsesionpas,
                    sessionid: sesion.sessionid
                },
                cliente: {
                    idusu: clienteResult.usuario.idusu,
                    idclipas: clienteResult.clientePasarela.idclipas,
                    idcliext: clienteResult.clientePasarela.idcliext,
                    esNuevo: clienteResult.esNuevo
                },
                tarjeta: {
                    idtarjpas: tarjetaResult.idtarjpas,
                    ultimos4: tarjetaOpenpay.tarjeta.card_number?.slice(-4),
                    marca: tarjetaOpenpay.tarjeta.brand
                },
                suscripcion: {
                    idsuscpas: suscripcionResult.idsuscpas,
                    idsuscext: suscripcionOpenpay.suscripcion.id,
                    status: suscripcionOpenpay.suscripcion.status,
                    proximoCobro: suscripcionOpenpay.suscripcion.charge_date
                },
                transaccion: {
                    idtranspas: transaccionResult.idtranspas,
                    monto: montoPlan
                },
                venta: ventaResult?.success ? {
                    idven: ventaResult.idven,
                    origenventa: 'V',
                    idcaja
                } : null,
                membresia: membresiaResult?.success ? {
                    idmem: membresiaResult.idmem,
                    estado: 'S',
                    barcpro
                } : null
            }
        };

    } catch (error) {
        console.log('');
        console.log('#'.repeat(60));
        console.log('# ✗ ERROR EN FLUJO DE PAGO');
        console.log('#'.repeat(60));
        console.log(`# Error: ${error.message}`);
        console.log('#'.repeat(60));

        // Registrar error en historial de sesión si existe
        if (sesion?.idsesionpas) {
            await registrarHistorialSesion(
                sesion.idsesionpas,
                'PAGO_FALLIDO',
                error.message,
                auditContext.ipaddress,
                { stack: error.stack?.substring(0, 500) }
            );

            // Cerrar sesión como Fallida
            await cerrarSesion(sesion.idsesionpas, 'F');
        }

        return {
            success: false,
            error: error.message,
            mensaje: 'Error al procesar el pago',
            datos: {
                sesion: sesion ? { idsesionpas: sesion.idsesionpas } : null,
                cliente: clienteResult?.success ? {
                    idusu: clienteResult.usuario?.idusu,
                    idclipas: clienteResult.clientePasarela?.idclipas
                } : null
            }
        };
    }
}

// ============================================================================
// ENDPOINT: CONFIRMAR PEDIDO (Flujo completo de 16 pasos)
// ============================================================================

/**
 * Handler para cuando el cliente hace click en "Confirmar Pedido"
 * Ejecuta el flujo completo de 16 pasos
 */
async function confirmarPedido(req, res) {
    try {
        const {
            datosCliente,
            tokenTarjeta,
            deviceSessionId,
            planId,
            idplanpas,
            montoPlan,
            barcpro
        } = req.body;

        // Validar datos requeridos
        if (!datosCliente || !datosCliente.numeroDocumento) {
            return res.json({
                success: false,
                error: 'Datos del cliente incompletos',
                mensaje: 'Se requiere el número de documento'
            });
        }

        if (!tokenTarjeta) {
            return res.json({
                success: false,
                error: 'Token de tarjeta requerido',
                mensaje: 'Debe tokenizar la tarjeta primero'
            });
        }

        if (!planId) {
            return res.json({
                success: false,
                error: 'Plan requerido',
                mensaje: 'Debe seleccionar un plan de suscripción'
            });
        }

        // Crear contexto de auditoría
        const auditContext = AuditContext.fromRequest(req);

        // Ejecutar flujo completo de 16 pasos
        const resultado = await procesarPagoCompleto({
            datosCliente,
            tokenTarjeta,
            deviceSessionId,
            planId,
            idplanpas,
            montoPlan,
            barcpro
        }, auditContext);

        return res.json(resultado);

    } catch (error) {
        console.error('[confirmarPedido] Error:', error.message);
        return res.json({
            success: false,
            error: error.message,
            mensaje: 'Error interno al procesar el pedido'
        });
    }
}

// ============================================================================
// EXPORTACIONES
// ============================================================================

module.exports = {
    // === FASE 0: SESIÓN (Primero) ===
    crearSesionPago,                // Paso 1
    registrarHistorialSesion,       // Paso 2, 10, 15

    // === FASE 1: CLIENTE ===
    buscarUsuarioPorDocumento,      // Paso 3
    buscarClientePasarela,          // Paso 4
    crearUsuario,                   // Paso 5
    crearClienteEnOpenpay,          // Paso 6
    registrarClientePasarela,       // Paso 7

    // === FASE 2: TARJETA ===
    asociarTarjetaEnOpenpay,        // Paso 8
    guardarTarjetaPasarela,         // Paso 9 (con idapilog)

    // === FASE 3: SUSCRIPCIÓN ===
    suscribirClienteEnOpenpay,      // Paso 11
    guardarSuscripcionPasarela,     // Paso 12 (con idapilog)

    // === FASE 4: TRANSACCIÓN Y CIERRE ===
    registrarTransaccion,           // Paso 13 (con idapilog)
    cerrarSesion,                   // Paso 16

    // === FASE 5: VENTA Y MEMBRESÍA ===
    crearVentaVirtual,              // Paso 17
    crearVentaDetalle,              // Paso 18
    crearMembresia,                 // Paso 19
    actualizarTransaccionConVenta,  // Paso 20

    // Flujos principales
    procesarCliente,                // Pasos 3-7
    procesarPagoCompleto,           // Pasos 1-20 (flujo completo)

    // Handler del endpoint
    confirmarPedido,

    // Re-exportar servicio para uso directo
    openpayService
};
