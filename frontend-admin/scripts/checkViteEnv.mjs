import fs from "node:fs";
import path from "node:path";

const [, , serviceName = "frontend-admin", mode = process.env.MODE || "production"] = process.argv;
const appEnvs = new Set(["development", "test", "staging", "production"]);

if (!appEnvs.has(mode)) {
  throw new Error(`MODE must be one of ${Array.from(appEnvs).join(", ")}.`);
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function loadEnv(cwd, modeName) {
  return {
    ...parseEnvFile(path.join(cwd, ".env")),
    ...parseEnvFile(path.join(cwd, ".env.local")),
    ...parseEnvFile(path.join(cwd, `.env.${modeName}`)),
    ...parseEnvFile(path.join(cwd, `.env.${modeName}.local`)),
    ...process.env,
  };
}

function validateUrl(name, value, errors, required) {
  if (!value) {
    if (required) {
      errors.push(`${name} is required for ${mode} builds.`);
    }
    return;
  }

  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      errors.push(`${name} must use http or https.`);
    }
    if (["staging", "production"].includes(mode) && ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      errors.push(`${name} must not point to localhost for ${mode} builds.`);
    }
  } catch {
    errors.push(`${name} must be a valid URL.`);
  }
}

function isExplicitlyPublicBrowserKey(key) {
  return /_(PUBLISHABLE|PUBLIC|ANON)_KEY$/i.test(key);
}

const cwd = process.cwd();
const env = loadEnv(cwd, mode);
const errors = [];
const requiresPublicApiUrl = ["staging", "production"].includes(mode);

validateUrl("VITE_API_BASE_URL", env.VITE_API_BASE_URL || "", errors, requiresPublicApiUrl);
validateUrl("VITE_PROXY_TARGET", env.VITE_PROXY_TARGET || "", errors, false);

for (const [key, value] of Object.entries(env)) {
  if (!key.startsWith("VITE_")) {
    continue;
  }

  const exposesLikelyCredential =
    /DATABASE|PASSWORD|SECRET|TOKEN|PRIVATE/i.test(key) ||
    (/KEY/i.test(key) && !isExplicitlyPublicBrowserKey(key));

  if (exposesLikelyCredential) {
    errors.push(`${key} must not be exposed to browser code through a VITE_ variable.`);
  }
  if (/mysql:\/\/|postgres:\/\/|jwt|secret/i.test(String(value))) {
    errors.push(`${key} looks like it contains a secret or database URL.`);
  }
}

if (errors.length > 0) {
  throw new Error([`Invalid ${serviceName} environment configuration:`, ...errors.map((error) => `- ${error}`)].join("\n"));
}

console.log(`${serviceName} ${mode} environment configuration is valid`);
