const express = require('express');
const axios = require('axios');
const session = require('express-session');
const app = express();
const PORT = 3000;
const config = require('./config.json')

const settings = {
    api: {
        url: config.api.url,
        key: config.api.key
    }
};

// Configure session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000 * 60 } // Session expires in 1 hour
}));

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Middleware to parse JSON and URL-encoded data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Route to display the form and VPS list
app.get('/', (req, res) => {
    const vpsList = req.session.vpsList || [];
    res.render('index', { message: '', vpsList });
});

// Route to handle the creation of a VPS
app.get('/create-server', async (req, res) => {
    const { ram, cores } = req.query;

    if (!ram || !cores || ram > 64 || cores > 16) {
        return res.render('index', { 
            message: `RAM must be <= 64GB and Cores <= 16.`, 
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

        // Check if the response status is 200
        if (response.status === 200) {
            const newVps = {
                container_id: response.data.container_id,
                ssh_command: response.data.ssh_command,
                ram,
                cores,
                status: 'online'
            };

            // Save VPS instance to session
            req.session.vpsList = req.session.vpsList || [];
            req.session.vpsList.push(newVps);

            res.render('index', { 
                message: 'Server created successfully!', 
                vpsList: req.session.vpsList 
            });
        } else {
            res.render('index', { 
                message: 'Failed to create server. Status code: ' + response.status, 
                vpsList: req.session.vpsList || [] 
            });
        }
    } catch (error) {
        console.error(error);
        res.render('index', { 
            message: 'An error occurred while creating the server' + error, 
            vpsList: req.session.vpsList || [] 
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
