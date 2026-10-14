# Site Liu e Lui Semijoias

Site da loja Liu e Lui (Tivoli Shopping, Santa Bárbara d'Oeste/SP) com catálogo
de produtos e painel de cadastro pelo próprio site.

Trabalho do Curso Técnico em Informática.

## Tecnologias
- Node.js + Express (servidor e API)
- PostgreSQL (catálogo de produtos)
- HTML, CSS e JavaScript puro (front-end, sem frameworks)

## Estrutura
- `server.js` — servidor e API do catálogo
- `public/index.html` — página do site
- `public/css/style.css` — estilos (rosa, dourado e preto)
- `public/js/script.js` — catálogo, filtros e painel de cadastro
- `public/img/logo.png` — logo da loja

## Variáveis de ambiente
- `DATABASE_URL` — conexão do PostgreSQL. Sem ela, o site grava num arquivo JSON temporário.
- `ADMIN_SENHA` — senha do painel de cadastro.
- `PORT` — porta do servidor (a hospedagem define sozinha).

## Rodar na sua máquina
```bash
npm install
npm start
```
Depois abra http://localhost:3000

## API
| Método | Rota | Para quê |
|---|---|---|
| GET | `/api/produtos` | Lista os produtos |
| POST | `/api/login` | Confere a senha do painel |
| POST | `/api/produtos` | Cadastra (precisa da senha) |
| PUT | `/api/produtos/:id` | Edita (precisa da senha) |
| DELETE | `/api/produtos/:id` | Exclui (precisa da senha) |

As rotas protegidas exigem o cabeçalho `x-senha`.
