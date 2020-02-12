import Sequelize from 'sequelize';

class User extends Sequelize.Model {};

export function initModel(sequelize) {
    User.init({
        chatId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            unique: true,
        },
        isAdmin: {
            type: Sequelize.BOOLEAN,
            allowNull: true,
        },
        filters: {
            type: Sequelize.JSON,
            defaultValue: {},
        },
        username: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        firstName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        lastName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
    }, {
          sequelize,
          modelName: 'user'
    });
}

export default User;
