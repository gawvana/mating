const fs = require("fs");
const path = require("path");

const distDir = path.resolve(__dirname, "../dist");
const indexPath = path.join(distDir, "index.html");

if (!fs.existsSync(indexPath)) {
  console.error("FATAL: dist/index.html does not exist!");
  process.exit(1);
}

const html = fs.readFileSync(indexPath, "utf-8");

// 1. Check that index.html does NOT contain /src/main.tsx
if (html.includes("/src/main.tsx") || html.includes("src/main.tsx")) {
  console.error("FATAL: dist/index.html still references /src/main.tsx!");
  process.exit(1);
}

// 2. Extract script sources
const scriptMatches = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => m[1]);
// 3. Extract link hrefs
const linkMatches = [...html.matchAll(/<link[^>]+href=["']([^"']+)["']/g)].map(m => m[1]);

console.log("Found scripts:", scriptMatches);
console.log("Found links:", linkMatches);

let hasProductionScript = false;

for (const src of scriptMatches) {
  // Ignore external scripts like telegram-web-app.js
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("//")) {
    continue;
  }

  // Must point to /assets/ or assets/
  if (src.includes("assets/")) {
    hasProductionScript = true;
  }

  const cleanPath = src.startsWith("/") ? src.slice(1) : src;
  const filePath = path.join(distDir, cleanPath);

  if (!fs.existsSync(filePath)) {
    console.error(`FATAL: Script asset does not exist on disk: ${src} -> ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  if (content === html) {
    console.error(`FATAL: Script asset ${src} is identical to index.html (SPA fallback leak)!`);
    process.exit(1);
  }

  if (content.length === 0) {
    console.error(`FATAL: Script asset ${src} is empty!`);
    process.exit(1);
  }
}

if (!hasProductionScript) {
  console.error("FATAL: No compiled production script found in dist/index.html!");
  process.exit(1);
}

for (const href of linkMatches) {
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
    continue;
  }

  if (href.includes("assets/")) {
    const cleanPath = href.startsWith("/") ? href.slice(1) : href;
    const filePath = path.join(distDir, cleanPath);

    if (!fs.existsSync(filePath)) {
      console.error(`FATAL: Link asset does not exist on disk: ${href} -> ${filePath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(filePath, "utf-8");
    if (content === html) {
      console.error(`FATAL: Link asset ${href} is identical to index.html!`);
      process.exit(1);
    }
  }
}

console.log("✓ Production build verification passed: all assets compiled and validated.");
process.exit(0);
