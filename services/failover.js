const Region = require('../models/Region');

const runFailover = async () => {
    const regions = await Region.find({ status: 'UP' }).sort({ priority: 1 });

    if (regions.length === 0) {
        await Region.updateMany({}, { isActive: false });
        return;
    }

    const bestRegion = regions[0];

    await Region.updateMany({}, { isActive: false });
    bestRegion.isActive = true;
    await bestRegion.save();
};

// Run every 30 seconds
setInterval(runFailover, 30000);

module.exports = runFailover;
