const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "packages", "shared");
const dest = path.join(root, "packages", "api", "vendor", "shared");

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(path.join(src, "package.json"), path.join(dest, "package.json"));
fs.cpSync(path.join(src, "dist"), path.join(dest, "dist"), { recursive: true });
console.log("Vendored @motory/shared -> packages/api/vendor/shared");