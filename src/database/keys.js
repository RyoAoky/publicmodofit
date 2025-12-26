const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/../../.env' });

module.exports = {
    dbSettings: {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        database: process.env.DB_NAME,
        options: {
            encrypt: true,
            trustServerCertificate: true
        }
    }
};
