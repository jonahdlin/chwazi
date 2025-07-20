const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIST_DIR = path.join(__dirname, "dist");
const SRC_DIR = __dirname;

const FILES_TO_HASH = ["main.js", "fps.js", "style.css", "favicon.png"];

if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true });
}
fs.mkdirSync(DIST_DIR);

const hashMap = {};

for (const filename of FILES_TO_HASH) {
  const filePath = path.join(SRC_DIR, filename);
  const content = fs.readFileSync(filePath);
  const hash = crypto
    .createHash("md5")
    .update(content)
    .digest("hex")
    .slice(0, 8);
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  const newName = `${base}.${hash}${ext}`;
  const newPath = path.join(DIST_DIR, newName);
  fs.writeFileSync(newPath, content);
  hashMap[filename] = newName;
}

// Copy and rewrite index.html
const indexPath = path.join(SRC_DIR, "index.html");
let html = fs.readFileSync(indexPath, "utf8");

for (const [orig, hashed] of Object.entries(hashMap)) {
  html = html.replace(new RegExp(orig, "g"), hashed);
}

fs.writeFileSync(path.join(DIST_DIR, "index.html"), html);
