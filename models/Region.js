const mongoose = require('mongoose');

const RegionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    priority: {
        type: Number,
        required: true
    },
    isActive: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['UP', 'DOWN'],
        default: 'UP'
    },
    lastChecked: {
        type: Date,
        default: Date.now
    },
    responseTime: {
        type: Number
    }
});

module.exports = mongoose.model('Region', RegionSchema);
