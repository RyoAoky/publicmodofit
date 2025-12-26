const express = require('express');
const router = express.Router();

// Página principal
router.get('/', (req, res) => {
    res.render('home/index', { 
        layout: 'public',
        title: 'ModoFit - Tu Gimnasio',
        user: req.user || null
    });
});

// Página de servicios
router.get('/servicios', (req, res) => {
    res.render('home/servicios', { 
        layout: 'public',
        title: 'Nuestros Servicios - ModoFit',
        user: req.user || null
    });
});

// Página de contacto
router.get('/contacto', (req, res) => {
    res.render('home/contacto', { 
        layout: 'public',
        title: 'Contacto - ModoFit',
        user: req.user || null
    });
});

// Página de nosotros
router.get('/nosotros', (req, res) => {
    res.render('home/nosotros', { 
        layout: 'public',
        title: 'Nosotros - ModoFit',
        user: req.user || null
    });
});

module.exports = router;


