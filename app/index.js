const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const { createClient } = require("redis");

const PORT = process.env.PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static(__dirname + "/public"));

// CONNECT REDIS CORRECTLY 🔥
const pub = createClient({ url: `redis://${REDIS_HOST}:6379` });
const sub = createClient({ url: `redis://${REDIS_HOST}:6379` });
const store = createClient({ url: `redis://${REDIS_HOST}:6379` });

async function start() {

    // connect all redis clients
    await pub.connect();
    await sub.connect();
    await store.connect();

    await sub.subscribe("wb_events", (msg) => {
        io.emit("draw", JSON.parse(msg));          // broadcast cross-node updates
    });

    io.on("connection", async (socket) => {
        console.log("Client connected → replaying history");

        // read stored history first
        const history = await store.lRange("history", 0, -1);
        history.forEach(e => socket.emit("draw", JSON.parse(e)));

        // forwarding events
        socket.on("draw", async (data) => {
            socket.broadcast.emit("draw", data);                    // show to local
            await store.rPush("history", JSON.stringify(data));     // persist 🔥
            await pub.publish("wb_events", JSON.stringify(data));   // sync globally
        });
    });

    server.listen(PORT, "0.0.0.0", () =>
        console.log(`Whiteboard live on ${PORT}`));
}

start().catch(err => console.log("REDIS ERROR →", err));
