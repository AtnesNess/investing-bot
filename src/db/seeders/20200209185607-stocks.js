const {collectStocks} = require('../../../dist/utils/stocks-collector');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const stocks = await collectStocks();

        return await queryInterface.bulkInsert(
            'stocks',
            stocks.map(({ticker}) => ({
                ticker,
                createdAt: new Date(),
                updatedAt: new Date(),
            }))
        );
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.bulkDelete('stocks', null, {});
    }
};
