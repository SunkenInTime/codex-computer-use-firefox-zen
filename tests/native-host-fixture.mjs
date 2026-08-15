#!/usr/bin/env node

const file = process.env.CHATGPT_FIREFOX_TEST_FILE ?? "";
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
const payload = Buffer.from(JSON.stringify(message), "utf8");
const header = Buffer.alloc(4);
header.writeUInt32LE(payload.length, 0);
process.stdout.write(Buffer.concat([header, payload]));
