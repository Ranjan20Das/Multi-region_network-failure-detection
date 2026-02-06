const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');
const jwt = require('jsonwebtoken');
const auth = require('./middleware/auth');
const failover = require('./services/failover');
const cors = require('cors');


dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Import Model
const Region = require('./models/Region');

// 🔌 MongoDB Connection
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB Connected');
    })
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err);
    });

// 🩺 Test Route
app.get('/', (req, res) => {
    res.send('Network Failover SaaS Backend Running');
});

// 📡 Get all region statuses
app.get('/api/status', async (req, res) => {
    try {
        const regions = await Region.find();
        res.json(regions);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ➕ Add a new region (Admin API)
app.post('/api/region', auth, async (req, res) => {
    try {
        const { name, url, priority } = req.body;

        if (!name || !url || priority === undefined) {
            return res.status(400).json({
                message: 'Name, URL and priority are required'
            });
        }

        const newRegion = new Region({
            name,
            url,
            priority
        });

        await newRegion.save();

        res.status(201).json({
            message: 'Region added successfully',
            region: newRegion
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
});

// 🔐 Admin Register (one-time use)
app.post('/api/admin/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password required' });
        }

        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({ message: 'Admin already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const admin = new Admin({
            email,
            password: hashedPassword
        });

        await admin.save();

        res.status(201).json({ message: 'Admin registered successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// 🔐 Admin Login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password required' });
        }

        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Access Token (short life)
        const accessToken = jwt.sign(
            { adminId: admin._id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Refresh Token (long life)
        const refreshToken = jwt.sign(
            { adminId: admin._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Save refresh token in DB
        admin.refreshToken = refreshToken;
        await admin.save();

        res.json({
            accessToken,
            refreshToken
        });


        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// 🔄 Refresh Access Token
app.post('/api/admin/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ message: 'Refresh token required' });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

        // Find admin with this refresh token
        const admin = await Admin.findOne({
            _id: decoded.adminId,
            refreshToken
        });

        if (!admin) {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        // Generate new access token
        const newAccessToken = jwt.sign(
            { adminId: admin._id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ accessToken: newAccessToken });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Refresh token expired' });
        }
        res.status(401).json({ message: 'Invalid refresh token' });
    }
});

// 🚪 Admin Logout
app.post('/api/admin/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ message: 'Refresh token required' });
        }

        // Remove refresh token from DB
        await Admin.updateOne(
            { refreshToken },
            { $unset: { refreshToken: "" } }
        );

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});


// ✏️ Update region (Admin API)
app.put('/api/region/:id', auth, async (req, res) => {
    try {
        const updatedRegion = await Region.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!updatedRegion) {
            return res.status(404).json({ message: 'Region not found' });
        }

        res.json({
            message: 'Region updated successfully',
            region: updatedRegion
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// 🗑️ Delete region (Admin API)
app.delete('/api/region/:id', auth, async (req, res) => {
    try {
        const deletedRegion = await Region.findByIdAndDelete(req.params.id);

        if (!deletedRegion) {
            return res.status(404).json({ message: 'Region not found' });
        }

        res.json({ message: 'Region deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// 🌍 Get Active Region (Public API)
app.get('/api/active-region', async (req, res) => {
    try {
        const activeRegion = await Region.findOne({ isActive: true });

        if (!activeRegion) {
            return res.status(503).json({
                message: 'No active region available'
            });
        }

        res.json({
            name: activeRegion.name,
            url: activeRegion.url,
            status: activeRegion.status,
            responseTime: activeRegion.responseTime,
            lastChecked: activeRegion.lastChecked
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});




// 🚀 Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

