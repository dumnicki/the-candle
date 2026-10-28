import { mountCandle } from "./candle";
import { blowDetectionStatus } from "./mic";
import "./styles.css";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Missing #app");

const room = document.createElement("main");
room.className = "room";

const eyebrow = document.createElement("p");
eyebrow.className = "eyebrow";
eyebrow.textContent = "Ghost in the Candle";

const candleHost = document.createElement("div");
candleHost.className = "candle-host";

const title = document.createElement("h1");
title.textContent = "The room is waiting.";

const status = document.createElement("p");
status.className = "status";
status.textContent = blowDetectionStatus();

room.append(eyebrow, candleHost, title, status);
app.append(room);
mountCandle(candleHost);
