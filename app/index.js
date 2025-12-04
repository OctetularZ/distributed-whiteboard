const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const redis = require("redis");

const PORT = process.env.PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static(__dirname + "/public"));

const pub = redis.createClient({ host: REDIS_HOST });
const sub = redis.createClient({ host: REDIS_HOST });
const store = redis.createClient({ host: REDIS_HOST }); // <- persistence DB

sub.subscribe("wb_events");

// When another VM publishes → broadcast to active users
sub.on("message", (channel, msg) => {
    const data = JSON.parse(msg);
    io.emit("draw", data);
});

// When new client joins → replay full history
io.on("connection", async (socket) => {
    console.log("Client connected → loading history");

    const history = await store.lrange("history", 0, -1);
    history.forEach(event => socket.emit("draw", JSON.parse(event)));

    socket.on("draw", data => {
        pub.publish("wb_events", JSON.stringify(data));       // sync to other nodes
        store.rpush("history", JSON.stringify(data));         // save persistently
        socket.broadcast.emit("draw", data);                  // show to local users
    });
});

server.listen(PORT,"0.0.0.0",()=>console.log("Server on",PORT));
