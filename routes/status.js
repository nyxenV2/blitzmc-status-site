// routes/status.js

const express = require('express');
const router = express.Router();
const Status = require('../models/Status');
const apiKeys = require('../config/apiKeys');
const axios = require('axios');
const discordConfig = require('../config/discord');

module.exports = (io) => {

    // In-memory storage for server last update timestamps
    const serverLastUpdate = {};

    // Expected interval (in milliseconds)
    const EXPECTED_INTERVAL = 120000; // 2 minutes

    // Middleware to validate API key
    router.use((req, res, next) => {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey || !apiKeys[apiKey]) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        req.serverId = apiKeys[apiKey];
        next();
    });

    // Function to send Discord notifications
    const sendDiscordNotification = async (serverId, status) => {
        try {
            const message = {
                username: 'Server Monitor',
                embeds: [{
                    title: `Alert: Server ${serverId} is ${status.toUpperCase()}`,
                    description: `The server **${serverId}** is now **${status}**.`,
                    color: status === 'offline' || status === 'crashed' ? 0xFF0000 : 0x00FF00,
                    timestamp: new Date()
                }]
            };

            await axios.post(discordConfig.webhookUrl, message);
        } catch (error) {
            console.error('Error sending Discord notification:', error);
        }
    };

    // POST route to receive data
    router.post('/', async (req, res) => {
        try {
            const serverId = req.serverId;
            const data = req.body;
            data.serverId = serverId;
            const statusData = new Status(data);
            await statusData.save();

            // Update last update timestamp
            serverLastUpdate[serverId] = Date.now();

            // Emit status update to connected clients
            io.emit('statusUpdate', data);

            // Send Discord notification if status is 'offline' or 'crashed'
            if (data.status === 'offline' || data.status === 'crashed') {
                sendDiscordNotification(serverId, data.status);
            }

            res.sendStatus(200);
        } catch (error) {
            console.error('Error saving status:', error);
            res.sendStatus(500);
        }
    });

    // GET route to retrieve the latest status of all servers
    router.get('/latest', async (req, res) => {
        try {
            const latestStatuses = await Status.aggregate([
                { $sort: { timestamp: -1 } },
                {
                    $group: {
                        _id: "$serverId",
                        doc: { $first: "$$ROOT" }
                    }
                }
            ]);

            // Check for servers that might have crashed
            const currentTime = Date.now();
            latestStatuses.forEach(status => {
                const serverId = status.doc.serverId;
                const lastUpdate = serverLastUpdate[serverId] || 0;
                if (currentTime - lastUpdate > EXPECTED_INTERVAL) {
                    if (status.doc.status !== 'crashed') {
                        status.doc.status = 'crashed';
                        // Send Discord notification for crash
                        sendDiscordNotification(serverId, 'crashed');
                    }
                }
            });

            res.json(latestStatuses.map(status => status.doc));
        } catch (error) {
            console.error('Error fetching statuses:', error);
            res.sendStatus(500);
        }
    });

    // GET route to retrieve historical data for a server
    router.get('/history/:serverId', async (req, res) => {
        try {
            const serverId = req.params.serverId;
            const { startTime, endTime } = req.query;

            // Validate dates
            const startDate = new Date(startTime);
            const endDate = new Date(endTime);

            if (isNaN(startDate) || isNaN(endDate)) {
                return res.status(400).json({ error: 'Invalid date format' });
            }

            const history = await Status.find({
                serverId: serverId,
                timestamp: { $gte: startDate, $lte: endDate }
            }).sort({ timestamp: 1 });

            res.json(history);
        } catch (error) {
            console.error('Error fetching historical data:', error);
            res.sendStatus(500);
        }
    });

    return router;
};
