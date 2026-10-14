// ===== Site Liu e Lui Semijoias =====
// Servidor Express: entrega o site e a API do catalogo.
// Banco: Postgres quando DATABASE_URL existir; senao, arquivo JSON local.

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORTA = process.env.PORT || 3000;
const SENHA = process.env.ADMIN_SENHA || "liuelui2026";
const URL_BANCO = process.env.DATABASE_URL || "";

app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---------- Camada de dados ----------
let banco;

function bancoJson() {
  const arquivo = path.join(__dirname, "dados", "produtos.json");
  const ler = () => {
    try {
      return JSON.parse(fs.readFileSync(arquivo, "utf8"));
    } catch {
      return [];
    }
  };
  const gravar = (lista) => {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    fs.writeFileSync(arquivo, JSON.stringify(lista, null, 2));
  };
  return {
    tipo: "arquivo JSON (temporario)",
    async iniciar() {
      if (!fs.existsSync(arquivo)) gravar([]);
    },
    async listar() {
      return ler().sort((a, b) => a.criado_em - b.criado_em);
    },
    async criar(p) {
      const lista = ler();
      const item = { id: Date.now().toString(36), criado_em: Date.now(), ...p };
      lista.push(item);
      gravar(lista);
      return item;
    },
    async atualizar(id, p) {
      const lista = ler();
      const i = lista.findIndex((x) => String(x.id) === String(id));
      if (i < 0) return null;
      lista[i] = { ...lista[i], ...p };
      gravar(lista);
      return lista[i];
    },
    async excluir(id) {
      const lista = ler();
      const restante = lista.filter((x) => String(x.id) !== String(id));
      gravar(restante);
      return restante.length !== lista.length;
    },
  };
}

function bancoPostgres() {
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: URL_BANCO,
    ssl: URL_BANCO.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  return {
    tipo: "PostgreSQL",
    async iniciar() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS liuelui_produtos (
          id         SERIAL PRIMARY KEY,
          nome       TEXT NOT NULL,
          categoria  TEXT NOT NULL,
          preco      NUMERIC(10,2) NOT NULL,
          foto       TEXT DEFAULT '',
          criado_em  BIGINT NOT NULL
        )`);
    },
    async listar() {
      const r = await pool.query(
        "SELECT id, nome, categoria, preco::float8 AS preco, foto, criado_em FROM liuelui_produtos ORDER BY criado_em ASC"
      );
      return r.rows;
    },
    async criar(p) {
      const r = await pool.query(
        "INSERT INTO liuelui_produtos (nome, categoria, preco, foto, criado_em) VALUES ($1,$2,$3,$4,$5) RETURNING id, nome, categoria, preco::float8 AS preco, foto, criado_em",
        [p.nome, p.categoria, p.preco, p.foto || "", Date.now()]
      );
      return r.rows[0];
    },
    async atualizar(id, p) {
      const r = await pool.query(
        "UPDATE liuelui_produtos SET nome=$1, categoria=$2, preco=$3, foto=$4 WHERE id=$5 RETURNING id, nome, categoria, preco::float8 AS preco, foto, criado_em",
        [p.nome, p.categoria, p.preco, p.foto || "", id]
      );
      return r.rows[0] || null;
    },
    async excluir(id) {
      const r = await pool.query("DELETE FROM liuelui_produtos WHERE id=$1", [id]);
      return r.rowCount > 0;
    },
  };
}

// ---------- Autenticacao simples do painel ----------
function exigirSenha(req, res, next) {
  if (req.get("x-senha") === SENHA) return next();
  res.status(401).json({ erro: "Senha incorreta." });
}

// ---------- Rotas da API ----------
app.get("/api/status", (_req, res) => {
  res.json({ ok: true, banco: banco.tipo });
});

app.post("/api/login", (req, res) => {
  if ((req.body && req.body.senha) === SENHA) return res.json({ ok: true });
  res.status(401).json({ erro: "Senha incorreta." });
});

app.get("/api/produtos", async (_req, res) => {
  try {
    res.json(await banco.listar());
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

function validar(body) {
  const nome = String(body.nome || "").trim();
  const categoria = String(body.categoria || "").trim();
  const preco = Number(body.preco);
  const foto = String(body.foto || "");
  if (!nome) return { erro: "Informe o nome do produto." };
  if (!["brincos", "colares", "aneis", "pulseiras"].includes(categoria))
    return { erro: "Categoria invalida." };
  if (!isFinite(preco) || preco < 0) return { erro: "Preco invalido." };
  if (foto && !/^data:image\/(png|jpeg|webp);base64,/.test(foto))
    return { erro: "Formato de imagem nao aceito." };
  return { dados: { nome, categoria, preco, foto } };
}

app.post("/api/produtos", exigirSenha, async (req, res) => {
  const v = validar(req.body);
  if (v.erro) return res.status(400).json({ erro: v.erro });
  try {
    res.status(201).json(await banco.criar(v.dados));
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.put("/api/produtos/:id", exigirSenha, async (req, res) => {
  const v = validar(req.body);
  if (v.erro) return res.status(400).json({ erro: v.erro });
  try {
    const item = await banco.atualizar(req.params.id, v.dados);
    if (!item) return res.status(404).json({ erro: "Produto nao encontrado." });
    res.json(item);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.delete("/api/produtos/:id", exigirSenha, async (req, res) => {
  try {
    const ok = await banco.excluir(req.params.id);
    if (!ok) return res.status(404).json({ erro: "Produto nao encontrado." });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ---------- Inicializacao ----------
(async () => {
  banco = URL_BANCO ? bancoPostgres() : bancoJson();
  try {
    await banco.iniciar();
    console.log("Banco pronto:", banco.tipo);
  } catch (e) {
    console.error("Falha ao iniciar o banco:", e.message);
    if (URL_BANCO) {
      console.error("Usando arquivo JSON temporario como reserva.");
      banco = bancoJson();
      await banco.iniciar();
    }
  }
  app.listen(PORTA, () => console.log("Site no ar na porta " + PORTA));
})();
