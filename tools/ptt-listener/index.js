/**
 * Push-to-talk global key listener for J.A.R.V.I.S.
 *
 * This has to run natively on the host (NOT inside Docker): capturing
 * keyboard events system-wide (even while a game has focus) requires a
 * low-level OS hook that a container cannot get access to. It talks to the
 * server over plain HTTP, so the server itself can still run in Docker —
 * only this small helper needs to run directly on Windows.
 *
 * Usage:
 *   npm install
 *   npm start
 */
const { GlobalKeyboardListener } = require("node-global-key-listener");

const SERVER_URL = process.env.JARVIS_SERVER_URL || "http://localhost:4000";
const CONFIG_POLL_MS = 5000;

let combo = [];
let comboWasDown = false;
let firstFetch = true;

async function fetchCombo() {
  try {
    const res = await fetch(`${SERVER_URL}/api/settings`);
    if (!res.ok) return;
    const data = await res.json();
    const nextCombo = data?.ptt?.enabled ? data.ptt.combo ?? [] : [];
    if (firstFetch || JSON.stringify(nextCombo) !== JSON.stringify(combo)) {
      firstFetch = false;
      combo = nextCombo;
      console.log(combo.length ? `Combinaison PTT active : ${combo.join(" + ")}` : "PTT désactivé (aucune combinaison configurée dans l'admin).");
    }
  } catch (err) {
    console.error(`Impossible de joindre le serveur J.A.R.V.I.S sur ${SERVER_URL} :`, err.message);
  }
}

function isComboDown(isDown) {
  if (combo.length === 0) return false;
  return combo.every((key) => isDown[key]);
}

async function sendEvent(type) {
  try {
    await fetch(`${SERVER_URL}/api/ptt/${type}`, { method: "POST" });
  } catch (err) {
    console.error(`Impossible d'envoyer l'evenement PTT (${type}) :`, err.message);
  }
}

async function main() {
  console.log("Ecoute des touches globales pour le push-to-talk J.A.R.V.I.S...");
  await fetchCombo();
  setInterval(fetchCombo, CONFIG_POLL_MS);

  const listener = new GlobalKeyboardListener();
  await listener.addListener((_event, isDown) => {
    const down = isComboDown(isDown);
    if (down && !comboWasDown) {
      comboWasDown = true;
      console.log("Push-to-talk : ON");
      sendEvent("press");
    } else if (!down && comboWasDown) {
      comboWasDown = false;
      console.log("Push-to-talk : OFF");
      sendEvent("release");
    }
  });
}

main().catch((err) => {
  console.error("Erreur fatale du listener PTT :", err);
  process.exit(1);
});
