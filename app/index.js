const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const redis = require("redis");

const PORT = process.env.PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// serve whiteboard UI
app.use(express.static(__dirname + "/public"));

// Redis clients
const pub = redis.createClient({ host: REDIS_HOST });
const sub = redis.createClient({ host: REDIS_HOST });

// Subscribe for events from other VMs
sub.subscribe("wb_events");

sub.on("message", (channel, message) => {
    const data = JSON.parse(message);
    io.emit("draw", data);       // broadcast to connected clients
});

// Handle local clients
io.on("connection", (socket) => {
    socket.on("draw", (data) => {
        // broadcast locally
        socket.broadcast.emit("draw", data);

        // send to Redis for cross-VM sync
        pub.publish("wb_events", JSON.stringify(data));
    });
});

server.listen(PORT, () => console.log("server running on " + PORT));
