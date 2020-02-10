import path from 'path'
import { Sequelize, ModelType } from 'sequelize';

import { getDirectoryFiles } from '../utils/fs';

const db: Map<string, ModelType> = new Map();

let sequelize: Sequelize;

export async function initDB(url: string) {
    sequelize = new Sequelize(url, {logging: Boolean(process.env.DB_LOGGING) ? console.log : false});

    await sequelize.authenticate();

    console.log('Connection has been established successfully.');

    const files: string[] = await getDirectoryFiles(path.join(__dirname, 'models'));

    for (let file of files) {
        const filename = path.join(__dirname, 'models', file);

        if (filename === __filename || filename.slice(-3) !== '.js') continue;;

        const req = await require(filename);
        const {initModel, default: Model} = req;

        db.set(Model.name, Model);

        await initModel(sequelize);
    }

    for (let Model of db.values()) {
        if ((<any>Model).associate) {
            (<any>Model).associate();
        }
    }

    sequelize = sequelize;

    await sequelize.sync();
}

export {
    db,
    sequelize,
    Sequelize
};

export default db;
