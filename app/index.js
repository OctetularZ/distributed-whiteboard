const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const redis = require("redis");   // v3 compatible

const PORT = process.env.PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static(__dirname + "/public"));

// ---- Redis v3 Clients ---- //
const pub    = redis.createClient({ host: REDIS_HOST, port: 6379 });
const sub    = redis.createClient({ host: REDIS_HOST, port: 6379 });
const store  = redis.createClient({ host: REDIS_HOST, port: 6379 });

// subscribe to incoming events
sub.subscribe("wb_events");

// replay stored history + handle draws
io.on("connection", socket => {

    console.log("Client connected → sending history");

    store.lrange("history", 0, -1, (err, events) => {
        if (!err && events) {
            events.forEach(e => socket.emit("draw", JSON.parse(e)));
        }
    });

    socket.on("draw", data => {
        socket.broadcast.emit("draw", data);             // local broadcast
        store.rpush("history", JSON.stringify(data));    // persist to redis
        pub.publish("wb_events", JSON.stringify(data));  // sync to other nodes
    });
});

// when another VM publishes → broadcast to browser
sub.on("message", (channel, msg) => {
    io.emit("draw", JSON.parse(msg));
});

server.listen(PORT, "0.0.0.0", () =>
    console.log("WHITEBOARD LIVE on", PORT)
);
