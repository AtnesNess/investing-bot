const dotenv = require('dotenv');

dotenv.config();

const env = process.env.NODE_ENV || 'development';

module.exports = {
  [env]: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    migrationStorageTableName: 'SequelizeMeta',
    logging: Boolean(process.env.DB_LOGGING) ? console.log : false,
    // ssl: true,
    // dialectOptions: {
    //   ssl: {
    //     require: true
    //   }
    // },
  },
  testing: {
    url: process.env.TESTING_DATABASE_URL,
    dialect: 'postgres',
    migrationStorageTableName: 'SequelizeMeta',
    logging: Boolean(process.env.DB_LOGGING) ? console.log : false,
  },
  production: {
    url: process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL,
    dialect: 'postgres',
    migrationStorageTableName: 'SequelizeMeta',
    ssl: true,
    dialectOptions: {
      ssl: {
        require: true
      }
    },
    logging: Boolean(process.env.DB_LOGGING) ? console.log : false,
  }
};