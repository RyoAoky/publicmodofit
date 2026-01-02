const passport = require('passport');
const helpers = require('../lib/helpers');
const { sequelize } = require('../database/conexionsqualize');
const { QueryTypes } = require('sequelize');

module.exports = {
    // Obtener usuario actual
    getMe(req, res) {
        if (req.user) {
            res.json({
                success: true,
                user: {
                    idcli: req.user.idcli,
                    nomcli: req.user.nomcli,
                    apecli: req.user.apecli,
                    emailcli: req.user.emailcli,
                    celcli: req.user.celcli
                }
            });
        } else {
            res.json({ success: false, user: null });
        }
    },

    // Procesar login con passport
    postLogin(req, res, next) {
        passport.authenticate('local.login', {
            successRedirect: '/dashboard',
            failureRedirect: '/auth/login',
            failureFlash: true
        })(req, res, next);
    },

    // Procesar registro
    async postRegistro(req, res) {
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
                 VALUES (:nombre, :apellido, :email, :telefono, :password, 'S', GETDATE())`,
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
    },

    // Cerrar sesión
    getLogout(req, res) {
        req.logout((err) => {
            if (err) {
                console.error('Error al cerrar sesión:', err);
            }
            res.redirect('/');
        });
    },

    // Procesar recuperación de contraseña
    async postRecuperar(req, res) {
        try {
            const { email } = req.body;
            
            // Verificar si existe el email
            const usuario = await sequelize.query(
                `SELECT * FROM Cliente WHERE emailcli = :email`,
                {
                    replacements: { email },
                    type: QueryTypes.SELECT
                }
            );

            if (usuario.length === 0) {
                req.flash('message', 'No existe una cuenta con ese correo electrónico');
                return res.redirect('/auth/recuperar');
            }

            // Aquí iría la lógica para enviar email de recuperación
            // Por ahora solo mostramos mensaje de éxito
            req.flash('success', 'Se ha enviado un correo con las instrucciones para recuperar tu contraseña');
            res.redirect('/auth/login');
        } catch (error) {
            console.error('Error en recuperación:', error);
            req.flash('message', 'Error al procesar la solicitud');
            res.redirect('/auth/recuperar');
        }
    }
};
