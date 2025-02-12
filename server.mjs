import * as path from "path";
import express from "express";
import WebSocket from "ws";
import { Console } from "console";

const port = process.env.PORT || 5000;

const apiKeys = {
    "apiKeyNumber1": new Date(),
    "apiPass": new Date(),
    "4b1545c4-4a70-4727-9ea1-152ed4c84ae2": new Date(),
    "4a226908-aa3e-4a34-a57d-1f3d1f6cba84": new Date(),
}

const colors = [
    "#140c1c",
    "#442434",
    "#30346d",
    "#4e4a4e",
    "#854c30",
    "#346524",
    "#d04648",
    "#757161",
    "#597dce",
    "#d27d2c",
    "#8595a1",
    "#6daa2c",
    "#d2aa99",
    "#6dc2ca",
    "#dad45e",
    "#deeed6",
];

const size = 256;
// place(x, y) := place[x + y * size]
const place = Array(size * size).fill(null);
for (const [colorIndex, colorValue] of colors.entries()) {
    for (let dx = 0; dx < size; dx++) {
        place[dx + colorIndex * size] = colorValue;
    }
}

const app = express();

app.use(express.static(path.join(process.cwd(), "client")));

app.get("/api/colors", (_, res) => {
    res.json(colors);
})

app.get("/*", (_, res) => {
    res.send("Place(holder)");
});

const server = app.listen(port, () => {
    console.log(`app on http://localhost:${port}/`);
});

const wss = new WebSocket.Server({
    noServer: true,
});

const timeoutValue = 3;

function pickValidation(x, y, color) {
    return 0 <= x && x <= 256 &&
        0 <= y && y <= 256 &&
        colors.includes(color);
}

wss.on('connection', function connection(ws) {
    let apiKey = keysMap.get(ws);
    ws.on('message', function message(message) {
        let date = new Date();
        let data = JSON.parse(message);
        if (data.type === "pick") {
            let {x, y, color} = data.payload;
            if (pickValidation(x, y, color)) {
                if (date > apiKeys[apiKey]) {
                    apiKeys[apiKey] = new Date(date.valueOf() + timeoutValue * 1000);
                    place[x + y * size] = color;
                    wss.clients.forEach(client => client.send(message));
                }
                ws.send(JSON.stringify({type: "timeout", payload: apiKeys[apiKey].toISOString()}));
            }
        }
    });

    ws.send(JSON.stringify({type: "timeout", payload: apiKeys[apiKey].toISOString()}))
    ws.send(JSON.stringify({type: "place", payload: place}));
});

let keysMap = new WeakMap()

server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, req.headers.origin);
    let apiKey = url.searchParams.get('apiKey');
    wss.handleUpgrade(req, socket, head, (ws) => {
        if (apiKey in apiKeys) {
            keysMap.set(ws, apiKey);
            wss.emit("connection", ws, req);
        } else {
            ws.send(JSON.stringify({type: "wrongApi"}));
          socket.destroy(new Error("Wrong api key"));
        };
    });
});