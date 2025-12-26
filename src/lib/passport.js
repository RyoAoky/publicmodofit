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
            `SELECT * FROM Cliente WHERE emailcli = :email AND estcli = 'A'`,
            {
                replacements: { email },
                type: QueryTypes.SELECT
            }
        );

        if (result.length > 0) {
            const user = result[0];
            const validPassword = await helpers.matchPassword(password, user.passcli);
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
    done(null, user.idcli);
});

passport.deserializeUser(async (id, done) => {
    try {
        const result = await sequelize.query(
            `SELECT * FROM Cliente WHERE idcli = :id AND estcli = 'A'`,
            {
                replacements: { id },
                type: QueryTypes.SELECT
            }
        );
        done(null, result[0]);
    } catch (error) {
        done(error);
    }
});
