import Sequelize from 'sequelize';

class Stock extends Sequelize.Model {};

export function initModel(sequelize) {
    Stock.init({
        name: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        ticker: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
        },
        lastEarningDate: {
            type: Sequelize.DATE,
            allowNull: true,
        },
    }, {
          sequelize,
          modelName: 'stock'
    });
}

export default Stock;
