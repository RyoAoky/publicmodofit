const express = require('express');
const router = express.Router();
const passport = require('passport');
const { isLoggedIn, isNotLoggedIn } = require('../lib/auth');
const helpers = require('../lib/helpers');
const { sequelize, QueryTypes } = require('../database/conexionsqualize');

// Página de login
router.get('/login', isNotLoggedIn, (req, res) => {
    res.render('auth/login', { 
        layout: 'auth',
        title: 'Iniciar Sesión - ModoFit'
    });
});

// Procesar login
router.post('/login', isNotLoggedIn, (req, res, next) => {
    passport.authenticate('local.login', {
        successRedirect: '/dashboard',
        failureRedirect: '/auth/login',
        failureFlash: true
    })(req, res, next);
});

// Página de registro
router.get('/registro', isNotLoggedIn, (req, res) => {
    res.render('auth/registro', { 
        layout: 'auth',
        title: 'Registro - ModoFit'
    });
});

// Procesar registro
router.post('/registro', isNotLoggedIn, async (req, res) => {
    try {
        const { nombre, apellido, email, telefono, password } = req.body;
        
        // Verificar si el email ya existe
        const existeUsuario = await sequelize.query(
            `SELECT * FROM Cliente WHERE emailcli = :email`,
            {
                replacements: { email },
                type: QueryTypes.SELECT
            }
        );

        if (existeUsuario.length > 0) {
            req.flash('message', 'El correo electrónico ya está registrado');
            return res.redirect('/auth/registro');
        }

        // Encriptar contraseña
        const hashedPassword = await helpers.EncriptarPass(password);

        // Insertar nuevo cliente
        await sequelize.query(
            `INSERT INTO Cliente (nomcli, apecli, emailcli, celcli, passcli, estcli, fecregcli) 
             VALUES (:nombre, :apellido, :email, :telefono, :password, 'A', GETDATE())`,
            {
                replacements: { 
                    nombre, 
                    apellido, 
                    email, 
                    telefono, 
                    password: hashedPassword 
                },
                type: QueryTypes.INSERT
            }
        );

        req.flash('success', 'Registro exitoso. Por favor inicia sesión.');
        res.redirect('/auth/login');
    } catch (error) {
        console.error('Error en registro:', error);
        req.flash('message', 'Error al registrar usuario');
        res.redirect('/auth/registro');
    }
});

// Cerrar sesión
router.get('/logout', isLoggedIn, (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
        }
        res.redirect('/');
    });
});

// Recuperar contraseña
router.get('/recuperar', isNotLoggedIn, (req, res) => {
    res.render('auth/recuperar', { 
        layout: 'auth',
        title: 'Recuperar Contraseña - ModoFit'
    });
});

module.exports = router;
