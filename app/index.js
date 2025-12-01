const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const redis = require("redis");

const PORT = process.env.PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// serve static UI
app.use(express.static(__dirname + "/public"));

// Redis
const pub = redis.createClient({ host: REDIS_HOST });
const sub = redis.createClient({ host: REDIS_HOST });

sub.subscribe("wb_events");

// receive from other VMs → broadcast
sub.on("message", (channel, message) => {
  const data = JSON.parse(message);
  io.emit("draw", data);
});

// local drawing event → send to redis + broadcast locally
io.on("connection", (socket) => {
  socket.on("draw", (data) => {
    socket.broadcast.emit("draw", data);
    pub.publish("wb_events", JSON.stringify(data));
  });
});

// IMPORTANT: listen on 0.0.0.0
server.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});
