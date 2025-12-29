const { sequelize } = require('../database/conexionsqualize');
const { QueryTypes } = require('sequelize');

module.exports = {
    // Render de páginas públicas
    async getHome(req, res) {
        res.render('home/index', { layout: 'public' });
    },
    async getServicios(req, res) {
        res.render('home/servicios', { layout: 'public' });
    },
    async getNosotros(req, res) {
        res.render('home/nosotros', { layout: 'public' });
    },
    async getContacto(req, res) {
        res.render('home/contacto', { layout: 'public' });
    },

    // Render de autenticación
    async getLogin(req, res) {
        res.render('auth/login', { layout: 'auth' });
    },
    async getRegistro(req, res) {
        res.render('auth/registro', { layout: 'auth' });
    },
    async getRecuperar(req, res) {
        res.render('auth/recuperar', { layout: 'auth' });
    },

    // Render de dashboard del cliente
    async getDashboard(req, res) {
        res.render('dashboard/index', { layout: 'dashboard' });
    },
    async getPerfil(req, res) {
        res.render('dashboard/perfil', { layout: 'dashboard' });
    },
    async getMembresias(req, res) {
        res.render('dashboard/membresias', { layout: 'dashboard' });
    },
    async getPedidos(req, res) {
        res.render('dashboard/pedidos', { layout: 'dashboard' });
    },

    // Render de pedidos/compras
    async getCatalogo(req, res) {
        res.render('pedidos/index', { layout: 'public' });
    },
    async getCarrito(req, res) {
        res.render('pedidos/carrito', { layout: 'public' });
    },
    async getCheckout(req, res) {
        try {
            // Consultar configuración de OpenPay desde la tabla PasarelaPago
            const pasarela = await sequelize.query(
                `SELECT merchantid, publickey, ambiente 
                 FROM PasarelaPago 
                 WHERE codpasarela = 'OPP' AND estado = 'S'`,
                { type: QueryTypes.SELECT }
            );

            const openpayConfig = pasarela[0] || {};
            const isSandbox = openpayConfig.ambiente === 'SANDBOX';

            res.render('pedidos/checkout', { 
                layout: 'public',
                openpayMerchantId: openpayConfig.merchantid || '',
                openpayPublicKey: openpayConfig.publickey || '',
                openpayIsSandbox: isSandbox
            });
        } catch (error) {
            console.error('Error al obtener configuración de pasarela:', error);
            res.render('pedidos/checkout', { 
                layout: 'public',
                openpayMerchantId: '',
                openpayPublicKey: '',
                openpayIsSandbox: true
            });
        }
    },
    async getConfirmacion(req, res) {
        res.render('pedidos/confirmacion', { layout: 'public' });
    },

    // Render de errores
    async get404(req, res) {
        res.status(404).render('errors/404', { layout: 'public' });
    }
};
