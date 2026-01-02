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
                `SELECT * FROM Producto WHERE estpro = 'A' ORDER BY nompro`,
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
            const idCliente = req.user ? req.user.idcli : null;

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
                // Pago exitoso - crear pedido
                const resultPedido = await sequelize.query(
                    `INSERT INTO Pedido (idcli, totped, metpagped, estped, fecped, refpago) 
                     OUTPUT INSERTED.idped
                     VALUES (:idCliente, :total, 'TARJETA', 'C', GETDATE(), :refPago)`,
                    {
                        replacements: { 
                            idCliente, 
                            total, 
                            refPago: resultadoCargo.cargo.id
                        },
                        type: QueryTypes.INSERT
                    }
                );

                const idPedido = resultPedido[0]?.idped;

                // Insertar items del pedido
                for (const item of items) {
                    await sequelize.query(
                        `INSERT INTO DetallePedido (idped, idpro, cantdp, predp) 
                         VALUES (:idPedido, :idProducto, :cantidad, :precio)`,
                        {
                            replacements: { 
                                idPedido, 
                                idProducto: item.id, 
                                cantidad: item.cantidad, 
                                precio: item.precio 
                            },
                            type: QueryTypes.INSERT
                        }
                    );
                }

                // Registrar pago en tabla de transacciones
                await sequelize.query(
                    `INSERT INTO PagoOpenPay (idped, transaction_id, authorization, amount, status, fecpago)
                     VALUES (:idPedido, :transactionId, :authorization, :amount, :status, GETDATE())`,
                    {
                        replacements: {
                            idPedido,
                            transactionId: resultadoCargo.cargo.id,
                            authorization: resultadoCargo.cargo.authorization,
                            amount: total,
                            status: 'completed'
                        },
                        type: QueryTypes.INSERT
                    }
                );

                res.json({ 
                    success: true, 
                    message: 'Pago procesado correctamente',
                    data: {
                        idPedido,
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

    // =========================================================================
    // PROCESAR SUSCRIPCIÓN COMPLETA (OpenPay)
    // Delegado a controllersql para mejor organización
    // =========================================================================
    postProcesarSuscripcion: controllersql.procesarSuscripcionCompleta,

    // =========================================================================
    // ENDPOINTS ADICIONALES
    // =========================================================================

    // Verificar membresía activa por DNI
    async getVerificarMembresia(req, res) {
        try {
            const { dni } = req.params;
            const resultado = await controllersql.verificarMembresiaActiva(dni);
            res.json({ success: true, data: resultado });
        } catch (error) {
            console.error('Error al verificar membresía:', error);
            res.json({ success: false, message: 'Error al verificar membresía' });
        }
    },

    // Obtener historial de suscripciones por DNI
    async getHistorialSuscripciones(req, res) {
        try {
            const { dni } = req.params;
            const historial = await controllersql.obtenerHistorialSuscripciones(dni);
            res.json({ success: true, data: historial });
        } catch (error) {
            console.error('Error al obtener historial:', error);
            res.json({ success: false, message: 'Error al obtener historial de suscripciones' });
        }
    },

    // Health check del servicio OpenPay
    async getHealthCheck(req, res) {
        try {
            const health = await controllersql.healthCheck();
            res.json({ success: true, data: health });
        } catch (error) {
            console.error('Error en health check:', error);
            res.json({ success: false, message: 'Error al verificar estado del servicio' });
        }
    },

    // Validar documento de identidad
    async postValidarDocumento(req, res) {
        try {
            const { tipoDocumento, numeroDocumento } = req.body;
            const validacion = controllersql.validarDocumento(tipoDocumento, numeroDocumento);
            res.json({ success: validacion.valido, message: validacion.mensaje || 'Documento válido' });
        } catch (error) {
            console.error('Error al validar documento:', error);
            res.json({ success: false, message: 'Error al validar documento' });
        }
    }
};
