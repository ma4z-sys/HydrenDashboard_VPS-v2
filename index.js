const express = require('express');
const axios = require('axios');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const app = express();
const config = require('./config.json');

const settings = {
    api: {
        url: config.api.url,
        key: config.api.key,
        port: config.api.port
    }
};

// Configure session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000 * 60 } // 1 hour session
}));

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Middleware to parse JSON and URL-encoded data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Route to render the login page
app.get('/', (req, res) => {
    const error = req.query.err;
    res.render('login', { error });
});

// Handle login logic
app.get('/auth/login', (req, res) => {
    const { username, password } = req.query;
    const userFolder = path.join(__dirname, 'users', username, password);

    // Check if the user folder exists
    if (fs.existsSync(userFolder)) {
        // Store user session
        req.session.isLoggedIn = true;
        req.session.username = username;

        res.redirect('/dashboard');
    } else {
        res.redirect('/?err=INVALID-CREDENTIALS');
    }
});

// Middleware to check if the user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.isLoggedIn) {
        return next();
    }
    res.redirect('/?err=Please login first');
}

// Route to render the dashboard
app.get('/dashboard', isAuthenticated, (req, res) => {
    const vpsList = req.session.vpsList || [];
    res.render('dashboard', { message: '', vpsList });
});

// Route to handle VPS creation (only accessible when logged in)
app.get('/create-server', isAuthenticated, async (req, res) => {
    const { ram, cores } = req.query;

    if (!ram || !cores || ram > 64 || cores > 16) {
        return res.render('dashboard', { 
            message: 'RAM must be <= 64GB and Cores <= 16.', 
            vpsList: req.session.vpsList || [] 
        });
    }

    try {
        const response = await axios.get(`${settings.api.url}/create-server`, {
            params: {
                ram,
                cores,
                'verify-key': settings.api.key
            }
        });

        if (response.status === 200) {
            const newVps = {
                container_id: response.data.container_id,
                ssh_command: response.data.ssh_command,
                ram,
                cores,
                status: 'online'
            };

            req.session.vpsList = req.session.vpsList || [];
            req.session.vpsList.push(newVps);

            res.render('dashboard', { 
                message: 'Server created successfully!', 
                vpsList: req.session.vpsList 
            });
        } else {
            res.render('dashboard', { 
                message: 'Failed to create server. Status code: ' + response.status, 
                vpsList: req.session.vpsList || [] 
            });
        }
    } catch (error) {
        console.error(error);
        res.render('dashboard', { 
            message: 'An error occurred while creating the server: ' + error.message, 
            vpsList: req.session.vpsList || [] 
        });
    }
});

app.get('/api/create/user', (req, res) => {
    const { username, password, 'verify-key': verifyKey } = req.query;

    // Check if all parameters are provided
    if (!username || !password || !verifyKey) {
        return res.status(400).json({ 
            error: 'Missing username, password, or verify-key' 
        });
    }

    // Validate the verify-key
    const VALID_KEY = 'hy-your-key';
    if (verifyKey !== VALID_KEY) {
        return res.status(403).json({ 
            error: 'Invalid verify-key' 
        });
    }

    // Define the directory path
    const userDir = path.join(__dirname, 'users', username, password);

    // Check if the user directory already exists
    if (fs.existsSync(userDir)) {
        return res.status(409).json({ 
            error: 'User already exists' 
        });
    }

    try {
        // Create the directory structure
        fs.mkdirSync(userDir, { recursive: true });
        console.log(`Directory created: ${userDir}`);

        // Send success response
        res.status(201).json({ 
            message: 'User created successfully', 
            username 
        });
    } catch (error) {
        console.error('Error creating directory:', error);
        res.status(500).json({ 
            error: 'Failed to create user directory' 
        });
    }
});

// Start the server
app.listen(settings.api.port, () => {
    console.log(`Server running on http://localhost:${settings.api.port}`);
});
