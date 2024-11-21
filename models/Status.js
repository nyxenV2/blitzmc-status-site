// models/Status.js

const mongoose = require('mongoose');

const statusSchema = new mongoose.Schema({
    serverId: String,
    status: String,
    playerCount: Number,
    maxPlayers: Number,
    timestamp: { type: Date, default: Date.now }
});

// Add index for performance
statusSchema.index({ serverId: 1, timestamp: 1 });

module.exports = mongoose.model('Status', statusSchema);
