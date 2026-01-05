/**
 * Controller de Pedidos para ModoFit Public
 * Maneja las operaciones de productos, pagos y visualización de pedidos
 * Utiliza controllersql para las operaciones de suscripción
 */

const { sequelize } = require('../database/conexionsqualize');
const { QueryTypes } = require('sequelize');
const openpayService = require('../services/openpayService');
const controllersql = require('./controllersql');

module.exports = {
    // Obtener productos disponibles
    async getProductos(req, res) {
        try {
            const productos = await sequelize.query(
                `SELECT * FROM Producto WHERE estpro = 'S' ORDER BY nompro`,
                { type: QueryTypes.SELECT }
            );

            res.json({ success: true, data: productos });
        } catch (error) {
            console.error('Error al obtener productos:', error);
            res.json({ success: false, message: 'Error al cargar productos' });
        }
    },

    // Obtener planes de membresía disponibles desde PasarelaPlan
    async getMembresias(req, res) {
        try {
            const planes = await sequelize.query(
                `SELECT 
                    pp.idplanpas,
                    pp.codplanext,
                    pp.nomplanext,
                    pp.precio,
                    pp.moneda,
                    pp.frecuencianum,
                    pp.frecuenciaunidad,
                    pp.diasprueba,
                    p.idpro,
                    p.barcpro,
                    p.despro,
                    p.picpro,
                    p.durpro,
                    p.cosvenpro,
                    pas.nompasarela,
                    pas.codpasarela
                FROM PasarelaPlan pp
                INNER JOIN Producto p ON pp.barcpro = p.barcpro
                INNER JOIN PasarelaPago pas ON pp.idpasarela = pas.idpasarela
                WHERE pp.estado = 'S' 
                    AND p.estpro = 'S'
                    AND pas.estado = 'S'
                ORDER BY pp.precio ASC`,
                { type: QueryTypes.SELECT }
            );

            res.json({ success: true, data: planes });
        } catch (error) {
            console.error('Error al obtener planes de membresía:', error);
            res.json({ success: false, message: 'Error al cargar planes de membresía' });
        }
    },

    // Procesar pago con tarjeta (OpenPay) - Pago único
    async postProcesarPago(req, res) {
        try {
            const { token_id, device_session_id, items, datosCliente, total } = req.body;
            const dniusu = req.user ? req.user.dniusu : null;
            const idusu = req.user ? req.user.idusu : null;

            // Usar el servicio de OpenPay para crear el cargo
            const resultadoCargo = await openpayService.crearCargo({
                source_id: token_id,
                amount: total,
                description: 'Compra en ModoFit',
                device_session_id: device_session_id,
                customer: {
                    name: datosCliente.nombre,
                    last_name: datosCliente.apellido,
                    email: datosCliente.email,
                    phone_number: datosCliente.telefono
                }
            });

            if (!resultadoCargo.success) {
                return res.json({
                    success: false,
                    message: resultadoCargo.error || 'Error al procesar el pago'
                });
            }

            if (resultadoCargo.cargo.status === 'completed') {
                // Obtener caja virtual
                const cajaResult = await openpayService.obtenerOCrearCajaVirtual();
                const idcaja = cajaResult.cajaVirtual?.idcaja || null;

                // Pago exitoso - crear venta (reemplaza Pedido)
                const resultVenta = await sequelize.query(
                    `INSERT INTO Venta (dniusu, totalven, subtotalven, cantpagven, codtipopago, estven, feccre, idcaja, idusuven, origenventa) 
                     OUTPUT INSERTED.idven
                     VALUES (:dniusu, :total, :total, :total, 'TR', 'S', GETDATE(), :idcaja, :idusu, 'W')`,
                    {
                        replacements: {
                            dniusu,
                            total,
                            idcaja,
                            idusu
                        },
                        type: QueryTypes.INSERT
                    }
                );

                const idVenta = resultVenta[0]?.idven;

                // Registrar pago en VentaPagos
                await sequelize.query(
                    `INSERT INTO VentaPagos (idven, codtipopago, monto, feccre, cambio) 
                     VALUES (:idVenta, 'TR', :total, GETDATE(), 0)`,
                    {
                        replacements: {
                            idVenta,
                            total
                        },
                        type: QueryTypes.INSERT
                    }
                );

                // Insertar items de la venta (reemplaza DetallePedido)
                for (const item of items) {
                    await sequelize.query(
                        `INSERT INTO VentaDetalle (idven, barcpro, cantvendet, subtotal, feccre, idusuven, cospro) 
                         SELECT :idVenta, barcpro, :cantidad, :subtotal, GETDATE(), :idusu, cosvenpro
                         FROM Producto WHERE idpro = :idProducto`,
                        {
                            replacements: {
                                idVenta,
                                idProducto: item.id,
                                cantidad: item.cantidad,
                                subtotal: item.precio * item.cantidad,
                                idusu
                            },
                            type: QueryTypes.INSERT
                        }
                    );
                }

                // Registrar pago en tabla de transacciones (Opcional: migrar a PasarelaTransaccion si es necesario)
                /*
                await sequelize.query(
                    `INSERT INTO PagoOpenPay (idped, transaction_id, authorization, amount, status, fecpago)
                     VALUES (:idPedido, :transactionId, :authorization, :amount, :status, GETDATE())`,
                    {
                        replacements: {
                            idPedido: idVenta, // Usar idVenta si la tabla fue actualizada
                            transactionId: resultadoCargo.cargo.id,
                            authorization: resultadoCargo.cargo.authorization,
                            amount: total,
                            status: 'completed'
                        },
                        type: QueryTypes.INSERT
                    }
                );
                */

                res.json({
                    success: true,
                    message: 'Pago procesado correctamente',
                    data: {
                        idPedido: idVenta,
                        authorization: resultadoCargo.cargo.authorization
                    }
                });
            } else {
                res.json({
                    success: false,
                    message: 'El pago no pudo ser procesado'
                });
            }
        } catch (error) {
            console.error('Error al procesar pago:', error.response?.data || error);
            res.json({
                success: false,
                message: error.response?.data?.description || 'Error al procesar el pago'
            });
        }
    },

    // Verificar estado de un pago
    async getEstadoPago(req, res) {
        try {
            const { transactionId } = req.params;

            // Obtener configuración de OpenPay desde BD
            const openpayConfig = await getOpenpayConfigFromDB();

            const openpayResponse = await axios.get(
                `${openpayConfig.apiUrl}/${openpayConfig.merchantId}/charges/${transactionId}`,
                {
                    auth: {
                        username: openpayConfig.privateKey,
                        password: ''
                    }
                }
            );

            res.json({
                success: true,
                data: {
                    status: openpayResponse.data.status,
                    amount: openpayResponse.data.amount,
                    authorization: openpayResponse.data.authorization
                }
            });
        } catch (error) {
            console.error('Error al verificar pago:', error);
            res.json({ success: false, message: 'Error al verificar el estado del pago' });
        }
    },

    // Obtener detalle de confirmación de pedido
    async getConfirmacionData(req, res) {
        try {
            const { id } = req.params;

            const pedido = await sequelize.query(
                `SELECT p.*, dp.*, pr.nompro 
                 FROM Pedido p
                 INNER JOIN DetallePedido dp ON p.idped = dp.idped
                 INNER JOIN Producto pr ON dp.idpro = pr.idpro
                 WHERE p.idped = :id`,
                {
                    replacements: { id },
                    type: QueryTypes.SELECT
                }
            );

            res.json({ success: true, data: pedido });
        } catch (error) {
            console.error('Error al obtener confirmación:', error);
            res.json({ success: false, message: 'Error al cargar confirmación del pedido' });
        }
    },

    // postProcesarSuscripcion delega al flujo completo de controllersql
    async postProcesarSuscripcion(req, res) {
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
                    mensaje: 'Se requiere el número de documento'
                });
            }

            if (!tokenTarjeta) {
                return res.json({
                    success: false,
                    mensaje: 'Debe tokenizar la tarjeta primero'
                });
            }

            if (!planId) {
                return res.json({
                    success: false,
                    mensaje: 'Debe seleccionar un plan de suscripción'
                });
            }

            // Crear contexto de auditoría
            const auditContext = {
                ipaddress: req.ip || req.connection?.remoteAddress,
                useragent: req.headers['user-agent']
            };

            // Ejecutar flujo completo
            const resultado = await controllersql.procesarPagoCompleto({
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
            console.error('[postProcesarSuscripcion] Error:', error.message);
            return res.json({
                success: false,
                mensaje: 'Error al procesar la suscripción',
                error: error.message
            });
        }
    },

    // =========================================================================
    // ENDPOINTS ADICIONALES
    // =========================================================================

    // Verificar membresía activa por DNI
    async getVerificarMembresia(req, res) {
        try {
            const { dni } = req.params;

            // Buscar membresía activa
            const resultado = await sequelize.query(
                `SELECT TOP 1 m.idmem, m.fecinimem, m.fecfinmem, m.diasmem, m.estamem,
                        p.nompro, u.nomusu, u.apellusu
                 FROM Membresia m
                 INNER JOIN Producto p ON m.barcpro = p.barcpro
                 INNER JOIN usuario u ON m.idusumem = u.idusu
                 WHERE m.dniusutit = :dni AND m.estamem = 'S'
                 ORDER BY m.fecfinmem DESC`,
                {
                    replacements: { dni },
                    type: QueryTypes.SELECT
                }
            );

            res.json({
                success: true,
                tieneMembresiaActiva: resultado.length > 0,
                data: resultado[0] || null
            });
        } catch (error) {
            console.error('Error al verificar membresía:', error);
            res.json({ success: false, message: 'Error al verificar membresía' });
        }
    },

    // Obtener historial de suscripciones por DNI
    async getHistorialSuscripciones(req, res) {
        try {
            const { dni } = req.params;

            const historial = await sequelize.query(
                `SELECT ps.idsuscpas, ps.idsuscext, ps.fecinicio, ps.fecproximocobro,
                        ps.estsuscripcion, pp.nomplanext, pp.precio,
                        pc.idcliext
                 FROM PasarelaSuscripcion ps
                 INNER JOIN PasarelaCliente pc ON ps.idclipas = pc.idclipas
                 INNER JOIN PasarelaPlan pp ON ps.idplanpas = pp.idplanpas
                 WHERE pc.dniusu = :dni
                 ORDER BY ps.fecinicio DESC`,
                {
                    replacements: { dni },
                    type: QueryTypes.SELECT
                }
            );

            res.json({ success: true, data: historial });
        } catch (error) {
            console.error('Error al obtener historial:', error);
            res.json({ success: false, message: 'Error al obtener historial de suscripciones' });
        }
    },

    // Health check del servicio OpenPay
    async getHealthCheck(req, res) {
        try {
            await openpayService.ensureInitialized();
            const config = openpayService.config;

            res.json({
                success: true,
                data: {
                    status: 'OK',
                    pasarela: config?.nompasarela || 'OpenPay',
                    ambiente: config?.ambiente || 'SANDBOX',
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error en health check:', error);
            res.json({ success: false, message: 'Error al verificar estado del servicio' });
        }
    },

    // Validar documento de identidad
    async postValidarDocumento(req, res) {
        try {
            const { tipoDocumento, numeroDocumento } = req.body;

            // Validación básica de documento
            let valido = false;
            let mensaje = '';

            if (!numeroDocumento) {
                mensaje = 'Número de documento requerido';
            } else if (tipoDocumento === 'DNI' && !/^\d{8}$/.test(numeroDocumento)) {
                mensaje = 'DNI debe tener 8 dígitos';
            } else if (tipoDocumento === 'CE' && !/^\d{9,12}$/.test(numeroDocumento)) {
                mensaje = 'Carnet de extranjería debe tener entre 9 y 12 dígitos';
            } else {
                valido = true;
                mensaje = 'Documento válido';
            }

            res.json({ success: valido, message: mensaje });
        } catch (error) {
            console.error('Error al validar documento:', error);
            res.json({ success: false, message: 'Error al validar documento' });
        }
    }
};
