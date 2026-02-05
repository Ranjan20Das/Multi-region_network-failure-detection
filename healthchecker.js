const mongoose = require('mongoose');
const axios = require('axios');
const dotenv = require('dotenv');
const Region = require('./models/Region');
const decideActiveRegion = require('./failoverManager');


dotenv.config();

// 🔌 Connect to MongoDB
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log('✅ HealthChecker connected to MongoDB'))
    .catch((err) => console.error('❌ MongoDB error:', err));

// ⏱ Health check interval (5 seconds)
const CHECK_INTERVAL = 5000;

// 🩺 Function to check a region
const checkRegionHealth = async (region) => {
    try {
        await axios.get(region.url, { timeout: 3000 });

        // If request succeeds
        region.status = 'UP';
        region.lastChecked = new Date();
    } catch (error) {
        // If request fails
        region.status = 'DOWN';
        region.lastChecked = new Date();
    }

    await region.save();
};

// 🔁 Main loop
const startHealthChecks = async () => {
    console.log('🔄 Health checks started...');

    setInterval(async () => {
        const regions = await Region.find();

        for (let region of regions) {
            await checkRegionHealth(region);
            console.log(
                `🌍 ${region.name} → ${region.status} (${region.url})`
            );
        }
        await decideActiveRegion();
    }, CHECK_INTERVAL);
};

startHealthChecks();
