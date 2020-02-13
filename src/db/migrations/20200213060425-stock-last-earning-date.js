'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return await queryInterface.addColumn(
      'stocks',
      'lastEarningDate',
      {
        type: Sequelize.DATE,
        allowNull: true,
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    return await queryInterface.removeColumn(
      'users',
      'lastEarningDate',
    );
  }
};
