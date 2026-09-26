const fs = require("fs");
const path = require("path");

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const root = path.join(__dirname, "..");
const exts = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html", ".md", ".yml", ".yaml", ".toml"]);
let fixed = 0;
for (const file of walk(root)) {
  if (!exts.has(path.extname(file)) && path.basename(file) !== ".gitignore") continue;
  const buf = fs.readFileSync(file);
  if (buf.length > 4 && buf[1] === 0 && buf[3] === 0) {
    const text = buf.toString("utf16le");
    // strip BOM if present
    const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    fs.writeFileSync(file, clean, "utf8");
    fixed++;
    console.log("fixed", path.relative(root, file));
  }
}
console.log(`Fixed ${fixed} files`);
