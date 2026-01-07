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
                    idcli: req.user.idusu,
                    nomcli: req.user.nomusu,
                    apecli: req.user.apellusu,
                    emailcli: req.user.mailusu,
                    celcli: req.user.contacusu
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

 

    // Cerrar sesión
    getLogout(req, res) {
        // Timeout de seguridad para evitar que se quede colgado
        const redirectTimeout = setTimeout(() => {
            console.warn('Logout timeout - redirigiendo de todas formas');
            res.clearCookie('connect.sid');
            if (!res.headersSent) {
                res.redirect('/');
            }
        }, 3000); // 3 segundos máximo

        try {
            // Primero hacer logout de passport
            req.logout((err) => {
                if (err) {
                    console.error('Error en req.logout:', err);
                }
                
                // Destruir la sesión completamente
                if (req.session) {
                    req.session.destroy((sessionErr) => {
                        clearTimeout(redirectTimeout);
                        if (sessionErr) {
                            console.error('Error al destruir sesión:', sessionErr);
                        }
                        
                        // Limpiar la cookie de sesión
                        res.clearCookie('connect.sid');
                        if (!res.headersSent) {
                            res.redirect('/');
                        }
                    });
                } else {
                    clearTimeout(redirectTimeout);
                    res.clearCookie('connect.sid');
                    if (!res.headersSent) {
                        res.redirect('/');
                    }
                }
            });
        } catch (error) {
            clearTimeout(redirectTimeout);
            console.error('Error en logout:', error);
            res.clearCookie('connect.sid');
            if (!res.headersSent) {
                res.redirect('/');
            }
        }
    },

    // Procesar recuperación de contraseña
    async postRecuperar(req, res) {
        try {
            const { email } = req.body;
            
            // Verificar si existe el email
            const usuario = await sequelize.query(
                `SELECT * FROM usuario WHERE mailusu = :email`,
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
