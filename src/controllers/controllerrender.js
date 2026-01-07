const { sequelize } = require('../database/conexionsqualize');
const { QueryTypes } = require('sequelize');

module.exports = {
    // Render de páginas públicas
    async getHome(req, res) {
        try {
            // Obtener planes activos desde PasarelaPlan + Producto
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
                    pas.nompasarela
                FROM PasarelaPlan pp
                INNER JOIN Producto p ON pp.barcpro = p.barcpro
                INNER JOIN PasarelaPago pas ON pp.idpasarela = pas.idpasarela
                WHERE pp.estado = 'S' 
                    AND p.estpro = 'S'
                    AND pas.estado = 'S'
                ORDER BY pp.precio ASC`,
                { type: QueryTypes.SELECT }
            );

            res.render('home/index', { 
                layout: 'public',
                planes: planes,
                tieneMultiplesPlanes: planes.length > 1
            });
        } catch (error) {
            console.error('Error al cargar planes:', error);
            res.render('home/index', { 
                layout: 'public',
                planes: [],
                tieneMultiplesPlanes: false
            });
        }
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

            // Parse plan parameters from query string
            const planData = {
                planId: req.query.planId || null,
                planName: req.query.planName || null,
                price: req.query.price ? parseFloat(req.query.price) : null,
                currency: req.query.currency || 'S/',
                duration: req.query.duration ? parseInt(req.query.duration) : null,
                frequency: req.query.frequency ? parseInt(req.query.frequency) : null,
                frequencyUnit: req.query.frequencyUnit || null,
                trialDays: req.query.trialDays ? parseInt(req.query.trialDays) : null,
                description: req.query.description || null
            };

            // Only include plan data if we have essential information
            const hasValidPlanData = planData.planId && planData.planName && planData.price;

            res.render('pedidos/checkout', { 
                layout: 'public',
                openpayMerchantId: openpayConfig.merchantid || '',
                openpayPublicKey: openpayConfig.publickey || '',
                openpayIsSandbox: isSandbox,
                planData: hasValidPlanData ? planData : null,
                hasPreselectedPlan: hasValidPlanData
            });
        } catch (error) {
            console.error('Error al obtener configuración de pasarela:', error);
            res.render('pedidos/checkout', { 
                layout: 'public',
                openpayMerchantId: '',
                openpayPublicKey: '',
                openpayIsSandbox: true,
                planData: null,
                hasPreselectedPlan: false
            });
        }
    },
    async getConfirmacion(req, res) {
        res.render('pedidos/confirmacion', { layout: 'public' });
    },

    // Render de páginas legales
    async renderFAQ(req, res) {
        res.render('legal/faq', { layout: 'public' });
    },
    async renderPrivacyPolicy(req, res) {
        res.render('legal/privacy-policy', { layout: 'public' });
    },
    async renderTermsConditions(req, res) {
        res.render('legal/terms-conditions', { layout: 'public' });
    },

    // Render de errores
    async get404(req, res) {
        res.status(404).render('errors/404', { layout: 'public' });
    }
};
