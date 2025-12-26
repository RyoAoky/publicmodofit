const dotenv = require('dotenv');
require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const { create } = require('express-handlebars');
const path = require('path');
const flash = require('connect-flash');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const Sequelize = require('sequelize');
const MSSQLStore = require('express-session-sequelize')(session.Store);
const fileUpload = require('express-fileupload');

const app = express();
app.use(fileUpload());

require('./lib/passport');

// Manejo de uncaughtException
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

app.set('port', process.env.PORT || 3300);
app.set('views', path.join(__dirname, 'views'));

const exphbs = create({
  extname: '.hbs',
  layoutsDir: path.join(__dirname, 'views', 'layouts'),
  defaultLayout: 'main',
  partialsDir: path.join(__dirname, 'views', 'partials'),
  helpers: require('./lib/handlebars')
});

app.engine('.hbs', exphbs.engine);
app.set('view engine', '.hbs');

app.use(cookieParser(process.env.SECRET_KEY));

app.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 43200000 // 12 horas en milisegundos
    },
    store: new MSSQLStore({
      db: new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
        host: process.env.DB_SERVER,
        dialect: 'mssql',
        dialectOptions: {
          options: {
            encrypt: true,
            trustServerCertificate: true
          }
        },
        logging: false
      }),
      checkExpirationInterval: 15 * 60 * 1000, // 15 minutos
      expiration: 24 * 60 * 60 * 1000 // 24 horas
    })
  })
);

app.use(flash());
app.use(morgan('dev'));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: false }));
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.message = req.flash('message');
  res.locals.user = req.user;
  next();
});

// Rutas
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/pedidos', require('./routes/pedidos'));
app.use('/dashboard', require('./routes/dashboard'));

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).render('errors/404', { layout: 'public' });
});

if (process.env.NODE_ENV !== 'production') {
  console.log(`Conectando a la BD: ${process.env.DB_NAME}`);
}

app.listen(app.get('port'), () => {
  console.log('Server on port', app.get('port'));
});
