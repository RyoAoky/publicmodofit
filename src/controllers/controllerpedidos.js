const { sequelize } = require('../database/conexionsqualize');
const { QueryTypes } = require('sequelize');
const axios = require('axios');

// Función helper para obtener configuración de OpenPay desde la BD
async function getOpenpayConfigFromDB() {
    const pasarela = await sequelize.query(
        `SELECT merchantid, publickey, privatekey, ambiente, urlapibase 
         FROM PasarelaPago 
         WHERE codpasarela = 'OPP' AND estado = 'S'`,
        { type: QueryTypes.SELECT }
    );
    
    if (!pasarela || pasarela.length === 0) {
        throw new Error('Configuración de OpenPay no encontrada en la base de datos');
    }
    
    const config = pasarela[0];
    const isSandbox = config.ambiente === 'SANDBOX';
    const apiUrl = config.urlapibase || (isSandbox 
        ? 'https://sandbox-api.openpay.pe/v1' 
        : 'https://api.openpay.pe/v1');
    
    return {
        merchantId: config.merchantid,
        privateKey: config.privatekey,
        publicKey: config.publickey,
        isSandbox,
        apiUrl
    };
}

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

    // Obtener tipos de membresía disponibles
    async getMembresias(req, res) {
        try {
            const membresias = await sequelize.query(
                `SELECT * FROM TipoMembresia WHERE esttm = 'A' ORDER BY pretm`,
                { type: QueryTypes.SELECT }
            );

            res.json({ success: true, data: membresias });
        } catch (error) {
            console.error('Error al obtener membresías:', error);
            res.json({ success: false, message: 'Error al cargar membresías' });
        }
    },

    // Procesar pago con tarjeta (OpenPay)
    async postProcesarPago(req, res) {
        try {
            const { token_id, device_session_id, items, datosCliente, total } = req.body;
            const idCliente = req.user ? req.user.idcli : null;

            // Obtener configuración de OpenPay desde BD
            const openpayConfig = await getOpenpayConfigFromDB();

            // Crear cargo en OpenPay
            const chargeData = {
                source_id: token_id,
                method: 'card',
                amount: total,
                currency: 'PEN',
                description: 'Compra en ModoFit',
                device_session_id: device_session_id,
                customer: {
                    name: datosCliente.nombre,
                    last_name: datosCliente.apellido,
                    email: datosCliente.email,
                    phone_number: datosCliente.telefono
                }
            };

            const openpayResponse = await axios.post(
                `${openpayConfig.apiUrl}/${openpayConfig.merchantId}/charges`,
                chargeData,
                {
                    auth: {
                        username: openpayConfig.privateKey,
                        password: ''
                    },
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (openpayResponse.data.status === 'completed') {
                // Pago exitoso - crear pedido
                const resultPedido = await sequelize.query(
                    `INSERT INTO Pedido (idcli, totped, metpagped, estped, fecped, refpago) 
                     OUTPUT INSERTED.idped
                     VALUES (:idCliente, :total, 'TARJETA', 'C', GETDATE(), :refPago)`,
                    {
                        replacements: { 
                            idCliente, 
                            total, 
                            refPago: openpayResponse.data.id
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
                            transactionId: openpayResponse.data.id,
                            authorization: openpayResponse.data.authorization,
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
                        authorization: openpayResponse.data.authorization
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
    }
};
