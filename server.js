const http = require('http');
const express = require('express');
const cors = require("cors");
const WebSocket = require("ws");
const helmet = require('helmet');
const path = require('path');
const menuRoutes = require('./routes/menu');
const orderRoutes = require('./routes/order');
const salesRoutes = require('./routes/sales');
const MenuItems = require('./routes/menuitems');
const routes = require('./routes/routes');
const customer = require('./routes/customer');
const settings = require('./routes/settings');
const tableRoutes = require('./routes/tables');
const tableorder = require('./routes/tableorder');
const charges = require('./routes/chargesapi');
const visitorInsights = require('./routes/visitorinsight');

const app = express();
const server = http.createServer(app);

// Configure CORS
const allowedOrigins = [
  'https://qr-backend-tusharkoshti-1s-projects.vercel.app',
];

app.use(cors({ origin: allowedOrigins }));

// Create WebSocket server
const wss = new WebSocket.Server({
  server,
  verifyClient: (info, done) => {
    if (!allowedOrigins.includes(info.origin)) {
      return done(false, 401, 'Unauthorized origin');
    }
    return done(true);
  }
});

console.log('WebSocket server initialized');

// WebSocket broadcast function
wss.broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

// Pass WebSocket server to routes
app.use((req, res, next) => {
  req.wss = wss;
  next();
});

// Middleware setup
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

app.use((req, res, next) => {
  // console.log('Content-Length:', req.headers['content-length']);
  next();
});

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    imgSrc: ["'self'", "https://67f3-2409-40c1-5004-fc74-37ee-99ef-5e2b-10ad.ngrok-free.app/api/add-menuitem"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
  },
}));

// Routes
app.use(menuRoutes);
app.use(orderRoutes);
app.use(salesRoutes);
app.use(visitorInsights);
app.use(settings);
app.use(charges);
app.use(tableRoutes);
app.use(customer);
app.use(MenuItems);
app.use(tableorder);
app.use(routes);

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  
  ws.on('message', (message) => {
    console.log('Received message:', message);
    // Handle incoming messages here
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running on same port`);
});