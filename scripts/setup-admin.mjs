// Local, interactive setup only. Never executed as part of build or deployment.
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";

if (!stdin.isTTY || !stdout.isTTY)
  throw new Error("Execute em um terminal interativo para proteger a senha.");
const input = createInterface({ input: stdin, output: stdout });
const login = (await input.question("Login administrativo (e-mail): "))
  .trim()
  .toLowerCase();
input.close();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login))
  throw new Error("E-mail inválido.");
function hidden(prompt) {
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    function done() {
      stdin.off("data", read);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    }
    function read(chunk) {
      for (const char of chunk) {
        if (char === "\u0003") {
          done();
          reject(new Error("Cancelado."));
          return;
        }
        if (char === "\r" || char === "\n") {
          done();
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    }
    stdin.on("data", read);
  });
}
const password = await hidden(
  "Senha (não aparece na tela, mínimo 14 caracteres): ",
);
if (password.length < 14 || password.length > 256)
  throw new Error("Use de 14 a 256 caracteres.");
if (password !== (await hidden("Repita a senha: ")))
  throw new Error("As senhas não coincidem.");
const hash = await hashPassword(password);
const secret = randomBytes(32).toString("hex");
const uri = createOTP(secret).url("Devotio", login);
const base32 = new URL(uri).searchParams.get("secret");
// Exclusive creation prevents accidentally replacing credentials needed for recovery.
await writeFile(
  ".env.admin.local",
  `ADMIN_LOGIN=${login}\nADMIN_PASSWORD_HASH=${hash}\nADMIN_TOTP_SECRET=${secret}\n`,
  { flag: "wx", mode: 0o600 },
);
stdout.write("\nAdicione uma conta manualmente no seu autenticador:\n");
stdout.write(
  `Nome: Devotio (${login})\nChave: ${base32}\nTipo: baseado em tempo, SHA-1, 6 dígitos, período de 30 segundos.\n`,
);
stdout.write(
  "\nAs três variáveis estão em .env.admin.local (ignorado pelo Git). Configure-as no deployment correto pelo dashboard Convex. Não compartilhe este arquivo ou a chave.\n",
);
