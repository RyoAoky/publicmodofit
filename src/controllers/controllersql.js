/**
 * Controller SQL para ModoFit Public
 * Maneja la lógica de negocio para suscripciones, usuarios y validaciones
 * Utiliza openpayService para las operaciones con la pasarela de pagos
 */

const { sequelize } = require('../database/conexionsqualize');
const { QueryTypes } = require('sequelize');
const openpayService = require('../services/openpayService');
const { AuditContext, sanitizeString } = require('../services/openpayService');

// ============================================================================
// OPERACIONES DE USUARIO
// ============================================================================

/**
 * Buscar usuario por DNI/Documento
 */
async function buscarUsuarioPorDni(numeroDocumento) {
    const dni = sanitizeString(numeroDocumento, 15);
    if (!dni) return null;
    
    const resultado = await sequelize.query(
        `SELECT idusu, nomusu, apellusu, mailusu, contacusu, dniusu, estusu 
         FROM usuario WHERE dniusu = :dni`,
        {
            replacements: { dni },
            type: QueryTypes.SELECT
        }
    );
    
    return resultado.length > 0 ? resultado[0] : null;
}

/**
 * Buscar usuario por email
 */
async function buscarUsuarioPorEmail(email) {
    const emailLimpio = email?.trim().toLowerCase();
    if (!emailLimpio) return null;
    
    const resultado = await sequelize.query(
        `SELECT idusu, nomusu, apellusu, mailusu, contacusu, dniusu, estusu 
         FROM usuario WHERE LOWER(mailusu) = :email`,
        {
            replacements: { email: emailLimpio },
            type: QueryTypes.SELECT
        }
    );
    
    return resultado.length > 0 ? resultado[0] : null;
}

/**
 * Crear nuevo usuario
 */
async function crearUsuario(datosCliente) {
    const { nombre, apellido, email, telefono, numeroDocumento, tipoDocumento } = datosCliente;
    
    // Sanitizar datos
    const nombreLimpio = sanitizeString(nombre, 50);
    const apellidoLimpio = sanitizeString(apellido, 50);
    const dniLimpio = sanitizeString(numeroDocumento, 15);
    const emailLimpio = email?.trim().toLowerCase() || '';
    const telefonoLimpio = telefono?.replace(/[^0-9]/g, '') || '';
    
    const result = await sequelize.query(
        `INSERT INTO usuario (
            nomusu, apellusu, dniusu, tipodoc, passusu, fecnacusu, 
            contacusu, mailusu, estusu, estintrausu, codgen, idrol, feccre
        )
        OUTPUT INSERTED.idusu, INSERTED.nomusu, INSERTED.apellusu, INSERTED.mailusu, INSERTED.dniusu
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
    
    return result[0]?.[0] || null;
}

/**
 * Buscar o crear usuario
 */
async function buscarOCrearUsuario(datosCliente) {
    const { numeroDocumento, email } = datosCliente;
    
    // Primero buscar por DNI
    let usuario = await buscarUsuarioPorDni(numeroDocumento);
    if (usuario) {
        return { usuario, esNuevo: false };
    }
    
    // Luego buscar por email
    usuario = await buscarUsuarioPorEmail(email);
    if (usuario) {
        return { usuario, esNuevo: false };
    }
    
    // Crear nuevo usuario
    const nuevoUsuario = await crearUsuario(datosCliente);
    return { usuario: nuevoUsuario, esNuevo: true };
}

// ============================================================================
// OPERACIONES DE CLIENTE OPENPAY
// ============================================================================

/**
 * Obtener o crear cliente en OpenPay (flujo completo)
 */
async function obtenerOCrearClienteOpenPay(usuario, datosCliente, auditContext = {}) {
    // 1. Verificar si ya existe en tabla local
    let clienteLocal = await openpayService.obtenerClienteLocal(usuario.idusu);
    
    if (clienteLocal && clienteLocal.idcliext) {
        // Verificar que el cliente existe en OpenPay
        const verificacion = await openpayService.obtenerCliente(clienteLocal.idcliext);
        
        if (verificacion.success) {
            return {
                success: true,
                cliente: verificacion.cliente,
                clienteLocal,
                yaExistia: true,
                idapilog: verificacion.idapilog // Incluir idapilog si hay
            };
        }
        // Si no existe en OpenPay, crear nuevo
    }
    
    // 2. Crear cliente en OpenPay
    const resultadoCreacion = await openpayService.crearCliente({
        name: datosCliente.nombre || usuario.nomusu,
        last_name: datosCliente.apellido || usuario.apellusu,
        email: datosCliente.email || usuario.mailusu,
        phone_number: datosCliente.telefono || usuario.contacusu,
        external_id: `MODOFIT-${datosCliente.numeroDocumento || usuario.dniusu}`
    }, auditContext);
    
    if (!resultadoCreacion.success) {
        return resultadoCreacion;
    }
    
    // 3. Guardar en tabla local con idapilog para trazabilidad
    const resultadoLocal = await openpayService.guardarClienteLocal({
        idusu: usuario.idusu,
        dniusu: datosCliente.numeroDocumento || usuario.dniusu,
        idcliext: resultadoCreacion.cliente.id,
        email: datosCliente.email || usuario.mailusu,
        telefono: datosCliente.telefono || usuario.contacusu,
        idapilog: resultadoCreacion.idapilog // Vincular con el registro del API log
    });
    
    return {
        success: true,
        cliente: resultadoCreacion.cliente,
        clienteLocal: resultadoLocal,
        yaExistia: false,
        idapilog: resultadoCreacion.idapilog // Pasar idapilog al flujo principal
    };
}

// ============================================================================
// OPERACIONES DE MEMBRESÍA
// ============================================================================

/**
 * Crear membresía para el usuario
 */
async function crearMembresia(data) {
    const { 
        dni, barcpro, idusu, duracionDias = 30, 
        idtipomem = 1 
    } = data;
    
    const dniLimpio = sanitizeString(dni, 15);
    const barcproLimpio = sanitizeString(barcpro, 50);
    
    await sequelize.query(
        `INSERT INTO Membresia (
            fecinimem, fecfinmem, diasmem, diasstock, ingmem, idtipomem, 
            dniusutit, barcpro, feccre, idusumem, estamem, codsta
        )
        VALUES (
            CAST(GETDATE() AS DATE), 
            DATEADD(DAY, :dias, CAST(GETDATE() AS DATE)), 
            :dias, :dias, 999, :idtipomem, 
            :dni, :barcpro, GETDATE(), :idusu, 'A', 'A'
        )`,
        {
            replacements: {
                dias: duracionDias,
                idtipomem,
                dni: dniLimpio,
                barcpro: barcproLimpio,
                idusu
            },
            type: QueryTypes.INSERT
        }
    );
    
    // Obtener ID de membresía insertada
    const membresia = await sequelize.query(
        `SELECT TOP 1 idmem FROM Membresia 
         WHERE dniusutit = :dni ORDER BY idmem DESC`,
        {
            replacements: { dni: dniLimpio },
            type: QueryTypes.SELECT
        }
    );
    
    // Registrar en auditoría de pasarela
    if (membresia[0]?.idmem) {
        try {
            await sequelize.query(
                `INSERT INTO PasarelaAuditoria (
                    tablaafectada, idregistro, accion, camposcambiados,
                    idusu, fecaudit
                ) VALUES (
                    'Membresia', :idregistro, 'INSERT', :camposcambiados,
                    :idusu, GETDATE()
                )`,
                {
                    replacements: {
                        idregistro: membresia[0].idmem,
                        camposcambiados: JSON.stringify({ 
                            dni: dniLimpio, 
                            barcpro: barcproLimpio, 
                            duracionDias 
                        }),
                        idusu
                    },
                    type: QueryTypes.INSERT
                }
            );
        } catch (auditError) {
            console.error('[Auditoría] Error al registrar:', auditError.message);
        }
    }
    
    return { success: true, idmem: membresia[0]?.idmem };
}

/**
 * Verificar si el usuario tiene membresía activa
 */
async function verificarMembresiaActiva(dniusu) {
    const dni = sanitizeString(dniusu, 15);
    if (!dni) return { activa: false };
    
    const resultado = await sequelize.query(
        `SELECT m.idmem, m.fecinimem, m.fecfinmem, m.diasstock, m.estamem,
                p.despro as nombrePlan
         FROM Membresia m
         INNER JOIN Producto p ON m.barcpro = p.barcpro
         WHERE m.dniusutit = :dni 
           AND m.estamem = 'A' 
           AND m.fecfinmem >= CAST(GETDATE() AS DATE)
         ORDER BY m.fecfinmem DESC`,
        {
            replacements: { dni },
            type: QueryTypes.SELECT
        }
    );
    
    if (resultado.length > 0) {
        return {
            activa: true,
            membresia: resultado[0]
        };
    }
    
    return { activa: false };
}

// ============================================================================
// FLUJO COMPLETO DE SUSCRIPCIÓN
// ============================================================================

/**
 * Procesar suscripción completa
 * Flujo: Usuario → Cliente OpenPay → Tarjeta → Suscripción → Membresía
 */
async function procesarSuscripcionCompleta(req, res) {
    const transaction = await sequelize.transaction();
    let idsesionpas = null; // Declarar fuera del try para acceso en catch
    
    try {
        const { token_id, device_session_id, datosCliente, plan } = req.body;
        const auditContext = AuditContext.fromRequest(req);
        
        // Validar datos requeridos
        if (!token_id || !device_session_id || !datosCliente || !plan) {
            return res.json({ 
                success: false, 
                message: 'Datos incompletos para procesar la suscripción' 
            });
        }

        const { nombre, apellido, email, telefono, tipoDocumento, numeroDocumento } = datosCliente;
        const { idplanpas, barcpro } = plan;

        console.log('[Suscripción] Iniciando proceso...');

        // 0. Crear sesión de pago
        const sesionPago = await openpayService.crearSesionPago({
            idusu: null, // Se actualizará cuando tengamos el usuario
            dniusu: numeroDocumento,
            devicesessionid: device_session_id,
            useragent: auditContext?.useragent,
            ipaddress: auditContext?.ipaddress,
            plataforma: 'WEB',
            barcpro: null, // Se actualizará con el plan
            montintentado: null
        });
        idsesionpas = sesionPago.idsesionpas;
        console.log(`[Suscripción] Sesión de pago creada: ${idsesionpas}`);

        // 1. Buscar o crear usuario
        const { usuario, esNuevo } = await buscarOCrearUsuario(datosCliente);
        console.log(`[Suscripción] Usuario ${esNuevo ? 'creado' : 'encontrado'}: ${usuario.idusu}`);

        // Actualizar sesión con usuario
        await openpayService.actualizarSesionPago(idsesionpas, { idusu: usuario.idusu });

        // 2. Verificar si ya tiene membresía activa
        const verificacionMembresia = await verificarMembresiaActiva(numeroDocumento);
        if (verificacionMembresia.activa) {
            await openpayService.actualizarSesionPago(idsesionpas, { estsesion: 'F' });
            await openpayService._registrarSesionHistorial(idsesionpas, 'VALIDACION_FALLIDA', 'Usuario ya tiene membresía activa');
            return res.json({
                success: false,
                message: `Ya tienes una membresía activa (${verificacionMembresia.membresia.nombrePlan}) vigente hasta ${new Date(verificacionMembresia.membresia.fecfinmem).toLocaleDateString('es-PE')}`
            });
        }

        // 3. Obtener el plan de la BD
        const planDB = await openpayService.obtenerPlanLocal(idplanpas);
        if (!planDB) {
            await openpayService.actualizarSesionPago(idsesionpas, { estsesion: 'F' });
            return res.json({ success: false, message: 'Plan no encontrado o inactivo' });
        }
        console.log(`[Suscripción] Plan OpenPay: ${planDB.codplanext}`);

        // Actualizar sesión con monto del plan
        await openpayService.actualizarSesionPago(idsesionpas, { montintentado: planDB.precio });

        // 4. Obtener o crear cliente en OpenPay
        const resultadoCliente = await obtenerOCrearClienteOpenPay(usuario, datosCliente, auditContext);
        if (!resultadoCliente.success) {
            await openpayService.actualizarSesionPago(idsesionpas, { estsesion: 'F' });
            await openpayService._registrarSesionHistorial(idsesionpas, 'CLIENTE_ERROR', resultadoCliente.error);
            return res.json({ success: false, message: resultadoCliente.error });
        }
        
        const customerId = resultadoCliente.cliente.id;
        const idclipas = resultadoCliente.clienteLocal?.idclipas;
        const idapilogCliente = resultadoCliente.idapilog;
        console.log(`[Suscripción] Cliente OpenPay: ${customerId} (${resultadoCliente.yaExistia ? 'existente' : 'nuevo'}) - ApiLog: ${idapilogCliente}`);

        await openpayService._registrarSesionHistorial(idsesionpas, 'CLIENTE_OBTENIDO', `Cliente ${customerId}`, auditContext?.ipaddress);

        // 5. Asociar tarjeta tokenizada
        const resultadoTarjeta = await openpayService.asociarTarjeta(customerId, token_id, device_session_id);
        if (!resultadoTarjeta.success) {
            await openpayService.actualizarSesionPago(idsesionpas, { estsesion: 'F' });
            await openpayService._registrarSesionHistorial(idsesionpas, 'TARJETA_ERROR', resultadoTarjeta.error);
            return res.json({ success: false, message: resultadoTarjeta.error });
        }
        
        const cardId = resultadoTarjeta.tarjeta.id;
        const idapilogTarjeta = resultadoTarjeta.idapilog;
        console.log(`[Suscripción] Tarjeta asociada: ${cardId} (${resultadoTarjeta.tarjeta.brand} ****${resultadoTarjeta.tarjeta.card_number?.slice(-4)}) - ApiLog: ${idapilogTarjeta}`);

        await openpayService._registrarSesionHistorial(idsesionpas, 'TARJETA_ASOCIADA', `Tarjeta ****${resultadoTarjeta.tarjeta.card_number?.slice(-4)}`);

        // 6. Guardar tarjeta en BD local
        let idtarjpas = null;
        if (idclipas) {
            const resultadoTarjetaLocal = await openpayService.guardarTarjetaLocal({
                idclipas,
                idtarjext: cardId,
                marca: resultadoTarjeta.tarjeta.brand,
                ultimos4: resultadoTarjeta.tarjeta.card_number?.slice(-4),
                anioexp: resultadoTarjeta.tarjeta.expiration_year,
                mesexp: resultadoTarjeta.tarjeta.expiration_month,
                holdername: resultadoTarjeta.tarjeta.holder_name,
                banco: resultadoTarjeta.tarjeta.bank_name,
                idapilog: idapilogTarjeta // Vincular con el API log
            });
            
            if (!resultadoTarjetaLocal.success || !resultadoTarjetaLocal.idtarjpas) {
                throw new Error('Error al guardar la tarjeta en el sistema');
            }
            idtarjpas = resultadoTarjetaLocal.idtarjpas;
            console.log(`[Suscripción] Tarjeta guardada localmente: ${idtarjpas}`);
        } else {
            throw new Error('No se pudo identificar el cliente para guardar la tarjeta');
        }

        // 7. Crear suscripción en OpenPay
        const resultadoSuscripcion = await openpayService.crearSuscripcion(customerId, planDB.codplanext, cardId);
        if (!resultadoSuscripcion.success) {
            await openpayService.actualizarSesionPago(idsesionpas, { estsesion: 'F' });
            await openpayService._registrarSesionHistorial(idsesionpas, 'SUSCRIPCION_ERROR', resultadoSuscripcion.error);
            return res.json({ success: false, message: resultadoSuscripcion.error });
        }
        
        const subscription = resultadoSuscripcion.suscripcion;
        const idapilogSuscripcion = resultadoSuscripcion.idapilog;
        console.log(`[Suscripción] Suscripción creada: ${subscription.id} - Estado: ${subscription.status} - ApiLog: ${idapilogSuscripcion}`);

        await openpayService._registrarSesionHistorial(idsesionpas, 'SUSCRIPCION_CREADA', `Suscripción ${subscription.id}`);

        // 8. Guardar suscripción en BD local
        let idsuscpas = null;
        if (idclipas && idtarjpas) {
            const resultadoSuscripcionLocal = await openpayService.guardarSuscripcionLocal({
                idclipas,
                idplanpas,
                idtarjpas,
                idsuscext: subscription.id,
                estsuscripcion: 'S',
                fecinicio: subscription.creation_date,
                fecfinperiodo: subscription.period_end_date,
                fecproximocobro: subscription.charge_date,
                idusu: usuario.idusu,
                idapilog: idapilogSuscripcion // Vincular con el API log
            });
            idsuscpas = resultadoSuscripcionLocal.idsuscpas;
            console.log(`[Suscripción] Suscripción guardada localmente: ${idsuscpas}`);
        }

        // 9. Registrar transacción
        const transaccionResult = await openpayService.registrarTransaccion({
            idusu: usuario.idusu,
            dniusu: numeroDocumento,
            idmem: null, // Se actualizará después
            idsuscpas,
            idsesionpas,
            idtransext: subscription.id,
            referenciaorden: `SUB-${subscription.id}`,
            tipotransaccion: 'SUSCRIPCION',
            estadoext: subscription.status === 'active' ? 'completed' : 'in_progress',
            montbruto: planDB.precio,
            montcomision: planDB.precio * (planDB.comisionporc || 0.0399),
            idtarjpas,
            jsonresponse: subscription,
            ipaddress: auditContext?.ipaddress,
            useragent: auditContext?.useragent,
            idapilog: idapilogSuscripcion
        });
        console.log(`[Suscripción] Transacción registrada: ${transaccionResult.idtranspas}`);

        // 10. Crear membresía
        const duracionDias = planDB.durpro || 30;
        const resultadoMembresia = await crearMembresia({
            dni: numeroDocumento,
            barcpro: planDB.barcpro,
            idusu: usuario.idusu,
            duracionDias
        });
        console.log(`[Suscripción] Membresía creada: ${resultadoMembresia.idmem}`);

        // 11. Actualizar sesión como completada
        await openpayService.actualizarSesionPago(idsesionpas, { 
            estsesion: 'C', 
            idtranspas: transaccionResult.idtranspas,
            idapilog: idapilogSuscripcion
        });
        await openpayService._registrarSesionHistorial(idsesionpas, 'PAGO_EXITOSO', `Membresía ${resultadoMembresia.idmem} creada`);

        await transaction.commit();

        // Respuesta exitosa
        res.json({
            success: true,
            message: 'Suscripción creada exitosamente',
            data: {
                subscriptionId: subscription.id,
                customerId: customerId,
                cardLast4: resultadoTarjeta.tarjeta.card_number?.slice(-4),
                cardBrand: resultadoTarjeta.tarjeta.brand,
                status: subscription.status,
                chargeDate: subscription.charge_date,
                periodEndDate: subscription.period_end_date,
                membresiaId: resultadoMembresia.idmem,
                duracionDias,
                transaccionId: transaccionResult.idtranspas,
                sesionId: idsesionpas
            }
        });

    } catch (error) {
        await transaction.rollback();
        
        console.error('[Suscripción] Error:', error.message || error);
        
        // Intentar marcar la sesión como fallida si existe
        try {
            if (typeof idsesionpas !== 'undefined' && idsesionpas) {
                await openpayService.actualizarSesionPago(idsesionpas, { estsesion: 'F' });
                await openpayService._registrarSesionHistorial(idsesionpas, 'ERROR', error.message);
            }
        } catch (sesionError) {
            console.error('[Suscripción] Error al actualizar sesión fallida:', sesionError.message);
        }
        
        let mensaje = 'Error al procesar la suscripción';
        if (error.response?.data?.description) {
            mensaje = error.response.data.description;
        } else if (error.message) {
            mensaje = error.message;
        }

        res.json({ success: false, message: mensaje });
    }
}

// ============================================================================
// VALIDACIONES
// ============================================================================

/**
 * Validar documento de identidad
 */
function validarDocumento(tipoDocumento, numeroDocumento) {
    const numero = (numeroDocumento || '').trim();
    
    const validaciones = {
        'DNI': {
            regex: /^\d{8}$/,
            mensaje: 'El DNI debe tener exactamente 8 dígitos'
        },
        'CE': {
            regex: /^[A-Z0-9]{9,12}$/i,
            mensaje: 'El Carnet de Extranjería debe tener entre 9 y 12 caracteres alfanuméricos'
        },
        'PASAPORTE': {
            regex: /^[A-Z0-9]{6,9}$/i,
            mensaje: 'El Pasaporte debe tener entre 6 y 9 caracteres alfanuméricos'
        }
    };
    
    const validacion = validaciones[tipoDocumento];
    if (!validacion) {
        return { valido: false, mensaje: 'Tipo de documento no válido' };
    }
    
    if (!validacion.regex.test(numero)) {
        return { valido: false, mensaje: validacion.mensaje };
    }
    
    return { valido: true };
}

/**
 * Validar email
 */
function validarEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validar teléfono peruano
 */
function validarTelefono(telefono) {
    const numero = (telefono || '').replace(/[^0-9]/g, '');
    return numero.length >= 9 && numero.length <= 12;
}

// ============================================================================
// CONSULTAS AUXILIARES
// ============================================================================

/**
 * Obtener planes disponibles
 */
async function obtenerPlanesDisponibles() {
    const planes = await sequelize.query(
        `SELECT 
            pp.idplanpas, pp.codplanext, pp.nomplanext, pp.precio, pp.moneda,
            pp.frecuencianum, pp.frecuenciaunidad, pp.diasprueba,
            p.idpro, p.barcpro, p.despro, p.picpro, p.durpro, p.cosvenpro,
            pas.nompasarela, pas.codpasarela
        FROM PasarelaPlan pp
        INNER JOIN Producto p ON pp.barcpro = p.barcpro
        INNER JOIN PasarelaPago pas ON pp.idpasarela = pas.idpasarela
        WHERE pp.estado = 'S' 
            AND p.estpro = 'S'
            AND pas.estado = 'S'
        ORDER BY pp.precio ASC`,
        { type: QueryTypes.SELECT }
    );
    
    return planes;
}

/**
 * Obtener historial de suscripciones del usuario
 */
async function obtenerHistorialSuscripciones(dniusu) {
    const dni = sanitizeString(dniusu, 15);
    if (!dni) return [];
    
    const resultado = await sequelize.query(
        `SELECT ps.idsuscpas, ps.idsuscext, ps.estsuscripcion, 
                ps.fecinicio, ps.fecfinperiodo, ps.fecproximocobro,
                pp.nomplanext, pp.precio, pp.frecuencianum, pp.frecuenciaunidad,
                m.idmem, m.fecinimem, m.fecfinmem, m.estamem
         FROM PasarelaSuscripcion ps
         INNER JOIN PasarelaPlan pp ON ps.idplanpas = pp.idplanpas
         INNER JOIN PasarelaCliente pc ON ps.idclipas = pc.idclipas
         LEFT JOIN Membresia m ON ps.idsuscpas = m.idsuscpas
         WHERE pc.dniusu = :dni
         ORDER BY ps.feccre DESC`,
        {
            replacements: { dni },
            type: QueryTypes.SELECT
        }
    );
    
    return resultado;
}

/**
 * Obtener estado del servicio OpenPay
 */
async function healthCheck() {
    return await openpayService.healthCheck();
}

// ============================================================================
// EXPORTACIONES
// ============================================================================

module.exports = {
    // Operaciones de usuario
    buscarUsuarioPorDni,
    buscarUsuarioPorEmail,
    crearUsuario,
    buscarOCrearUsuario,
    
    // Operaciones de cliente OpenPay
    obtenerOCrearClienteOpenPay,
    
    // Operaciones de membresía
    crearMembresia,
    verificarMembresiaActiva,
    
    // Flujo completo
    procesarSuscripcionCompleta,
    
    // Validaciones
    validarDocumento,
    validarEmail,
    validarTelefono,
    
    // Consultas
    obtenerPlanesDisponibles,
    obtenerHistorialSuscripciones,
    healthCheck,
    
    // Re-exportar servicio para uso directo
    openpayService
};
