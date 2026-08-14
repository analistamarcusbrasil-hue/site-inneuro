import { randomInt } from "node:crypto";

const protocolAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createContactProtocol(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += protocolAlphabet[randomInt(protocolAlphabet.length)];
  }
  return `FC-${date}-${code}`;
}
