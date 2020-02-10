import Sequelize from 'sequelize';

class Stock extends Sequelize.Model {};

export function initModel(sequelize) {
    Stock.init({
        ticker: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
        },
    }, {
          sequelize,
          modelName: 'stock'
    });
}

export default Stock;
