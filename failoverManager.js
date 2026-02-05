const Region = require('./models/Region');

const decideActiveRegion = async () => {
    try {
        // Get all healthy regions sorted by priority
        const healthyRegions = await Region.find({ status: 'UP' })
            .sort({ priority: 1 });

        if (healthyRegions.length === 0) {
            console.log('❌ No healthy regions available');
            return;
        }

        // Deactivate all regions
        await Region.updateMany({}, { isActive: false });

        // Activate highest priority healthy region
        const activeRegion = healthyRegions[0];
        activeRegion.isActive = true;
        await activeRegion.save();

        console.log(`Active Region set to: ${activeRegion.name}`);
    } catch (error) {
        console.error('❌ Failover decision error:', error.message);
    }
};

module.exports = decideActiveRegion;
