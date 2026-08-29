#!/usr/bin/env node

import fs from "node:fs";
import { spawn } from "node:child_process";

const outputLimit = 1024 * 1024;
const lingeringHostMilliseconds = 3000;
const file = process.env.CHATGPT_FIREFOX_TEST_FILE ?? "";
const mode = process.env.CHATGPT_FIREFOX_FIXTURE_MODE ?? "file-upload";

function writeFrame(payload) {
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  process.stdout.write(Buffer.concat([header, payload]));
}

function writeHeader(length) {
  const header = Buffer.alloc(4);
  header.writeUInt32LE(length, 0);
  process.stdout.write(header);
}

function spawnStderrDescendantThenWriteHeader(length) {
  const descendant = spawn(process.execPath, ["-e", [
    'const fs = require("node:fs");',
    `setTimeout(() => fs.writeFileSync(process.env.CHATGPT_FIREFOX_FIXTURE_COMPLETION_MARKER, "completed", "utf8"), ${lingeringHostMilliseconds});`
  ].join(" ")], {
    detached: true,
    stdio: ["ignore", "ignore", "inherit"]
  });
  descendant.once("error", (error) => {
    throw error;
  });
  descendant.once("spawn", () => {
    descendant.unref();
    const header = Buffer.alloc(4);
    header.writeUInt32LE(length, 0);
    process.stdout.write(header, () => process.exit(0));
  });
}

function writeFrameAndExit(payload) {
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  process.stdout.write(Buffer.concat([header, payload]), () => process.exit(0));
}

function writeSizedPayload(prefix, suffix, length) {
  const payload = Buffer.concat([prefix, Buffer.alloc(length - prefix.length - suffix.length, "x"), suffix]);
  if (payload.length !== length) {
    throw new Error(`Fixture message length mismatch: expected ${length}, got ${payload.length}`);
  }
  writeFrame(payload);
}

function writeSizedMessage(kind, length) {
  writeSizedPayload(Buffer.from(`{"kind":"${kind}","data":"`, "utf8"), Buffer.from('"}', "utf8"), length);
}

function writeEnrichmentOverflow() {
  writeSizedPayload(Buffer.from('{"method":"getInfo","padding":"', "utf8"), Buffer.from('"}', "utf8"), outputLimit);
}

function reportTruncatedInputDelivery() {
  let received = false;
  process.stdin.once("data", () => {
    received = true;
  });
  setTimeout(() => {
    writeFrameAndExit(Buffer.from(JSON.stringify(received
      ? { kind: "truncated-input-forwarded" }
      : { kind: "truncated-input-not-forwarded" }), "utf8"));
  }, 100);
}

function echoInput() {
  const chunks = [];
  process.stdin.on("data", (chunk) => chunks.push(chunk));
  process.stdin.on("end", () => {
    const input = Buffer.concat(chunks);
    if (input.length >= 4 && input.length === input.readUInt32LE(0) + 4) {
      writeFrameAndExit(input.subarray(4));
      return;
    }
    writeFrameAndExit(Buffer.from(JSON.stringify({ kind: "invalid-echo-input" }), "utf8"));
  });
}

function verifyLargeInput() {
  const chunks = [];
  process.stdin.on("data", (chunk) => chunks.push(chunk));
  process.stdin.on("end", () => {
    const input = Buffer.concat(chunks);
    const valid = input.length >= 4
      && input.length === input.readUInt32LE(0) + 4
      && input.subarray(4).every((byte) => byte === "i".charCodeAt(0));
    writeFrameAndExit(Buffer.from(JSON.stringify({
      kind: valid ? "large-input-received" : "large-input-invalid",
      receivedLength: input.length
    }), "utf8"));
  });
}

if (mode === "output-at-limit") {
  writeSizedMessage("output-at-limit", outputLimit);
} else if (mode === "output-above-limit") {
  writeSizedMessage("output-above-limit", outputLimit + 1);
} else if (mode === "output-above-limit-then-normal") {
  writeSizedMessage("output-above-limit", outputLimit + 1);
  writeFrame(Buffer.from('{"kind":"normal-after-oversize"}', "utf8"));
} else if (mode === "output-above-limit-then-wait") {
  writeSizedMessage("output-above-limit", outputLimit + 1);
  setTimeout(() => {
    fs.writeFileSync(process.env.CHATGPT_FIREFOX_FIXTURE_COMPLETION_MARKER, "completed", "utf8");
  }, lingeringHostMilliseconds);
} else if (mode === "output-above-limit-header-then-wait") {
  writeHeader(outputLimit + 1);
  setTimeout(() => {
    fs.writeFileSync(process.env.CHATGPT_FIREFOX_FIXTURE_COMPLETION_MARKER, "completed", "utf8");
  }, lingeringHostMilliseconds);
} else if (mode === "output-above-limit-header-then-stderr-descendant") {
  spawnStderrDescendantThenWriteHeader(outputLimit + 1);
} else if (mode === "enrichment-overflow") {
  writeEnrichmentOverflow();
} else if (mode === "verify-truncated-input") {
  reportTruncatedInputDelivery();
} else if (mode === "echo-input") {
  echoInput();
} else if (mode === "verify-large-input") {
  verifyLargeInput();
} else {
  const message = {
    jsonrpc: "2.0",
    id: 1,
    method: "executeCdp",
    appServerUrl: "ws://127.0.0.1:45678?token=test",
    serializedResult: JSON.stringify({
      localAppServerUrl: "ws://localhost:45678?clientId=nested"
    }),
    params: {
      method: "DOM.setFileInputFiles",
      commandParams: {
        files: [file]
      }
    }
  };
  writeFrame(Buffer.from(JSON.stringify(message), "utf8"));
}
