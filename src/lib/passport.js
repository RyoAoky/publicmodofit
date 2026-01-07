const { sequelize, QueryTypes } = require('../database/conexionsqualize');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const helpers = require('../lib/helpers');

passport.use('local.login', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true
}, async (req, email, password, done) => {
    try {
        // Buscar usuario por email en la tabla de clientes
        const result = await sequelize.query(
            `SELECT * FROM Usuario WHERE mailusu = :email AND estusu = 'S'`,
            {
                replacements: { email },
                type: QueryTypes.SELECT
            }
        );

        if (result.length > 0) {
            const user = result[0];
            const validPassword = await helpers.matchPassword(password, user.passusu);
            if (validPassword) {
                done(null, user);
            } else {
                done(null, false, req.flash('message', 'Contraseña incorrecta'));
            }
        } else {
            done(null, false, req.flash('message', 'El usuario no existe o está desactivado'));
        }
    } catch (error) {
        done(error);
    }
}));

passport.serializeUser((user, done) => {
    // Incluir tanto idusu como tokenusu en la sesión para validación de seguridad
    // Requirements: 5.2, 1.1
    done(null, { 
        idusu: user.idusu, 
        tokenusu: user.tokenusu 
    });
});

passport.deserializeUser(async (sessionData, done) => {
    try {
        // Validar usuario por token para mayor seguridad
        // Requirements: 5.2, 1.1
        const result = await sequelize.query(
            `SELECT * FROM Usuario WHERE tokenusu = :tokenusu AND estusu = 'S'`,
            {
                replacements: { tokenusu: sessionData.tokenusu },
                type: QueryTypes.SELECT
            }
        );
        
        // Verificar que el usuario existe y que el idusu coincide con la sesión
        if (result.length > 0 && result[0].idusu === sessionData.idusu) {
            done(null, result[0]);
        } else {
            // Token inválido o idusu no coincide - pasar null sin error para permitir logout
            // Esto permite que el usuario pueda cerrar sesión aunque el token sea inválido
            done(null, false);
        }
    } catch (error) {
        // En caso de error de BD, pasar null sin error para no bloquear el logout
        console.error('Error en deserializeUser:', error);
        done(null, false);
    }
});
