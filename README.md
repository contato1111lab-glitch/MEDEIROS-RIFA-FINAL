# Nova Plataforma

Plataforma de rifas online. React + Vite no frontend, API Express rodando como
uma Serverless Function na Vercel, Supabase como banco e Simplify como gateway
de pagamento PIX.

---

## ⚠️ Antes de subir: rotacione as credenciais

As chaves atuais do Supabase (incluindo a **service role**) e as credenciais da
Simplify circularam em texto puro — estavam no `.env` versionado, num arquivo
`server.cjs` publicado junto com o site, e hardcoded no código. **Considere
todas comprometidas.**

1. Supabase → *Settings → API* → **Rotate** a `service_role` key (e a `anon` key).
2. Simplify → gerar novo `client-id` / `client-secret`.
3. Cadastrar os novos valores apenas em *Vercel → Settings → Environment Variables*.
4. Nunca mais commitar o `.env` (já está no `.gitignore`).

---

## Estrutura

```
api/                      Serverless Function única (tudo sob /api)
  index.ts                Entrypoint: monta o Express e as rotas
  tsconfig.json           Compila a API como CommonJS (ver "Módulos" abaixo)
  package.json            { "type": "commonjs" }
  _handlers/              Handlers de rota (o prefixo _ evita virar função separada)
  _lib/                   Código de servidor: Supabase, pagamentos, regras de negócio
components/               Telas React
context/                  Contexto de cliente
services/                 Código de browser (chave anon) + proxy do painel admin
migrations/               SQL para rodar no Supabase
_legacy/                  Scripts e SQL antigos, fora do build e do deploy
```

**Regra que não pode ser quebrada:** `api/_lib/supabaseServer.ts` usa a
`service_role` key e **nunca** pode ser importado por nada em `components/`,
`context/` ou `services/`. O browser usa `services/supabaseClient.ts` (chave anon).

---

## Variáveis de ambiente

Copie `.env.example` para `.env` e cadastre os mesmos nomes na Vercel
(Production, Preview e Development).

| Variável | Obrigatória | Para quê |
|---|---|---|
| `VITE_SUPABASE_URL` | sim | Supabase no browser (vai para o bundle) |
| `VITE_SUPABASE_ANON_KEY` | sim | Chave anon, pública por natureza |
| `SUPABASE_URL` | sim | Supabase no servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | Ignora RLS. Trate como senha de root |
| `SUPER_ADMIN_PASSWORD_HASH` | sim | Hash bcrypt da senha mestra |
| `SIMPLIFY_CLIENT_ID` / `SIMPLIFY_CLIENT_SECRET` | sim | Gateway PIX |
| `WEBHOOK_SECRET` | sim | Autentica `/api/webhook/simplify` |
| `WEBHOOK_URL` | sim | URL informada à Simplify |
| `ALLOWED_ORIGINS` | não | Origens externas com permissão de CORS |

Gerar o hash da senha mestra:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1],12))" "SUA_SENHA"
```

Gerar o segredo do webhook:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Depois do deploy, confira tudo de uma vez em `https://SEU_SITE/api/health` — ele
responde quais segredos estão presentes (nunca os valores) e devolve **503** se
faltar algum.

---

## Deploy

1. Cadastrar todas as variáveis acima na Vercel.
2. Rodar `migrations/001_security_and_integrity.sql` no SQL Editor do Supabase.
3. `git push` — a Vercel builda o frontend com Vite e a API a partir de `api/index.ts`.

Rodar localmente:

```bash
npm install
npm run dev
```

Verificar antes de subir:

```bash
npm run lint
```

---

## Módulos: por que a API tem tsconfig e package.json próprios

Esta é a causa do `FUNCTION_INVOCATION_FAILED` que derrubava a API em produção,
e o motivo de várias tentativas de correção não resolverem.

O `tsconfig.json` da raiz usa `"module": "ESNext"` e
`"moduleResolution": "bundler"` — configuração feita para o Vite. A Vercel
compilava a API com esse mesmo tsconfig e gerava **ESM com imports sem
extensão**, que o Node não consegue carregar de nenhuma das duas formas:

| `api/package.json` | Erro no cold start |
|---|---|
| `{"type":"commonjs"}` | `SyntaxError: Cannot use import statement outside a module` |
| `{"type":"module"}` | `ERR_MODULE_NOT_FOUND: ...api/payments/create` |

A função morria antes de atender qualquer requisição, e a Vercel devolvia uma
página de erro em HTML — que o frontend tentava ler como JSON, produzindo
`Unexpected token 'A', "A server e"... is not valid JSON`.

A correção tem três partes:

1. `api/tsconfig.json` compila a API como **CommonJS** com resolução Node.
2. `api/package.json` declara `{"type":"commonjs"}`, casando com essa saída.
3. Todo o código de servidor vive **debaixo de `api/`**. Isso importa: o
   `package.json` da raiz tem `"type": "module"`, então arquivos compilados em
   `services/` eram tratados como ESM mesmo contendo CommonJS.

Se algum dia mover código de servidor para fora de `api/`, o erro volta.

Pastas dentro de `api/` começam com `_` porque a Vercel transforma **cada**
arquivo em `api/` numa função separada. `_handlers` e `_lib` ficam de fora do
roteamento, e `/api/*` é redirecionado para a função única em `api/index.ts`.

---

## Segurança

O que foi corrigido, e o que continua valendo como regra:

- **Senha mestra fora do banco.** Ficava em texto puro em `app_config`, tabela
  legível com a chave anon — qualquer visitante lia a senha e virava super admin.
  Agora só existe como hash bcrypt em `SUPER_ADMIN_PASSWORD_HASH`.
- **RLS ligada em todas as tabelas.** Antes as 14 tabelas eram legíveis por
  qualquer um, incluindo `profiles` (CPF, telefone, endereço, coluna `password`).
  `profiles` e `purchases` usam GRANT por coluna: o público vê nome, nunca PII.
- **`/api/admin/rpc` com allow-list.** Executava qualquer método de
  `raffleService` pelo nome vindo da requisição. Hoje só nomes declarados
  explicitamente rodam, com separação entre admin e super admin.
- **Webhook falha fechado.** A autenticação só rodava se `WEBHOOK_SECRET`
  existisse; sem a variável, qualquer um confirmava pagamentos. Agora responde
  503 se não estiver configurado.
- **Bypass de pagamento fechado.** A confirmação usava o `internal_id` enviado
  no corpo da requisição, então dava para parear a própria compra com o id de um
  PIX pago de outra pessoa e liberar cotas sem pagar. Agora só o id armazenado é
  usado, e o valor pago é conferido.
- **CORS com allow-list.** Refletia qualquer `Origin` junto com
  `Allow-Credentials: true`.
- **Sem credenciais no código.** As chaves da Simplify eram fallback hardcoded e
  vazavam no `dist/server.cjs` publicado junto com o site.

Pendências conhecidas:

- O rate limit usa memória local, que em serverless é por instância. Para limite
  real, usar um store compartilhado (Redis/Upstash).
- `services/raffleService.ts` ainda contém funções administrativas herdadas que
  não são chamadas pelo site público. Elas ficam inertes com a RLS ligada, mas
  deveriam ser removidas do bundle do browser.

---

## Erros que já foram diagnosticados

**"Not enough tickets available" / "Alta concorrência"** — 3 das 5 rifas tinham
`total_numbers` preenchido mas **zero** linhas em `raffle_ticket_pool`.
`createRaffle` chamava a RPC que gera as cotas e ignorava o erro, então a rifa
nascia sem cotas e o admin via "sucesso". A vitrine mostrava as cotas como
disponíveis porque esse número vem de `raffles.total_numbers`. Hoje a criação
falha e desfaz a rifa se o pool não for gerado, e a RPC de reserva conta o pool
real. A migração reconstrói os pools vazios.

**Upload de banner/favicon falhava depois da imagem chegar no Storage** — o
serviço de servidor era uma cópia do de browser e `updateSiteSettings` chamava
`localStorage.getItem()` na primeira linha, fora do `try`. Na Vercel isso é
`ReferenceError: localStorage is not defined`. A imagem já tinha subido; salvar
a configuração é que explodia.

**Telas administrativas com "Invalid action"** — 17 métodos chamados pelo painel
(CRM, log de auditoria, ranking, atribuição de bilhete, registro de ganhador,
simulação) não existiam em serviço nenhum. Foram implementados em
`api/_lib/raffleService.ts`.

**Tela de sucesso do pagamento quebrada** — `getPurchaseById`, `getProfileById`,
`getPurchaseStatus` e `adminGetTicketsByPurchase` eram chamados mas não existiam
no serviço do frontend. Agora passam por `GET /api/purchases/:id`.

---

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`. A API fica em `http://localhost:3000/api/health`.

O `npm run dev` passa por `dev.ts`, que carrega o `.env` para dentro de
`process.env` **antes** de importar o servidor e imprime quais variáveis estão
presentes.

Isso precisa ser um arquivo separado do `server.ts`: em ESM todos os `import`
são avaliados antes da primeira linha do módulo, e `api/_lib/supabaseServer.ts`
lê `process.env` no escopo do módulo — carregar o `.env` no topo do `server.ts`
seria tarde demais.

**Este era o motivo real de "funciona no Google AI Studio e em mais lugar
nenhum":** nada no projeto carregava o `.env`. O AI Studio injeta as variáveis
no processo automaticamente, então lá o Supabase respondia; em qualquer outro
ambiente `SUPABASE_SERVICE_ROLE_KEY` chegava `undefined`.

---

## Gateway Simplify — conferido contra a documentação oficial

**As credenciais que estavam embutidas no código não funcionam.** Testadas
contra `https://simplifybr.com/api/v1`, `vesat11_YA2SPNTV` /
`PZ4RKJUCWITX6JL` retornam `401 {"error":"Unauthorized","message":"Credenciais
de API inválidas."}`. Sem `SIMPLIFY_CLIENT_ID`/`SIMPLIFY_CLIENT_SECRET`
configurados, o código caía nesses valores e todo PIX falhava. Pegue as suas em
*Simplify → Integrações → API*.

**O campo `qrcode` da resposta é o copia-e-cola, não uma imagem.** A resposta
documentada do `POST /pix/deposit` é
`{ internal_id, external_id, status, qrcode, amount }`, e `qrcode` traz a string
EMV (começa com `000201`). O código anterior jogava esse valor no campo de
imagem e depois embrulhava qualquer string com mais de 100 caracteres em
`data:image/png;base64,…` — transformando um código PIX válido numa imagem
quebrada. Agora ele vai para `pixCode` e o `CheckoutModal` desenha o QR
localmente com `<QRCodeSVG value={pixCode} />`.

**O webhook da Simplify não é assinado.** A documentação não define header de
autenticação nem assinatura. Por isso o `WEBHOOK_SECRET` viaja como
`?token=…` na `webhookURL` enviada no depósito — o backend anexa isso sozinho.
Sem esse detalhe, com `WEBHOOK_SECRET` definido, todo webhook legítimo era
rejeitado com 401 e nenhum pagamento se confirmava.

**A "dupla checagem" não pode bloquear a confirmação.** O código consulta
`GET /pix/deposit/{id}` antes de liberar as cotas, mas esse endpoint não existe
na documentação. Quando a consulta falhava, o handler devolvia 500, a Simplify
tentava 3 vezes e desistia, e o cliente que pagou ficava sem cotas. Agora: se a
API responde e diz que não está pago, recusa; se a API não responde, o webhook
autenticado é aceito e o evento fica registrado como
`DOUBLE_CHECK_UNAVAILABLE`.

---

## Ordem das rifas

`getAllRaffles` não tinha `.order()` nenhum, então o Postgres devolvia as linhas
em ordem arbitrária e rifas novas caíam no fim. Agora ordena por
`is_featured DESC, created_at DESC`.

A Home usa `activeRaffles[0]` como card grande de destaque, então a ordem também
decide qual rifa aparece em destaque: marcar **Destaque** na rifa a fixa na
primeira posição; sem destaque, vale a mais recente.

---

## Contrato da RPC de reserva — a causa do bug de compra

A função `rpc_reserve_tickets` publicada neste banco devolve **um UUID puro**
(o `purchase_id`), não o objeto JSONB que os arquivos SQL do repositório
descrevem. O backend fazia:

```js
const purchaseId = rpcResult?.purchase_id;   // string não tem essa propriedade
if (rpcErr || !purchaseId) → "Falha ao reservar cotas"
```

Resultado: a reserva era feita com sucesso no banco e **mesmo assim** a compra
era reportada como falha. Cada tentativa prendia cotas em `RESERVED` que nunca
voltavam — foi assim que 16 cotas sumiram do estoque sem nenhuma venda paga, e
por que a rifa "esgotava" sem ter vendido.

A mensagem `Not enough tickets available` também vem dessa função publicada —
ela não existe em nenhum `.sql` do repositório, o que confirma que a versão no
banco é diferente da versionada.

Três correções:

1. `api/_handlers/payments/create.ts` aceita os dois formatos (UUID puro ou
   JSONB), então o checkout funciona antes e depois da migração.
2. Se o PIX falhar depois da reserva, as cotas voltam ao estoque na hora e a
   compra é cancelada, em vez de esperar a limpeza periódica.
3. A migração remove a função antiga antes de recriar — o Postgres recusa
   trocar o tipo de retorno com `CREATE OR REPLACE`
   (`cannot change return type of existing function`).

## Limpeza de reservas expiradas

`cancelExpiredPurchases` partia de `purchases` filtrando
`payment_status = 'pending'` e por isso não limpava nada: convivem duas
convenções de status no banco. A RPC antiga grava `status = 'PENDING'` com
`payment_status = NULL`; a nova grava `'pending'` nos dois campos. Reservas da
primeira ficavam presas para sempre.

Agora a varredura parte do próprio pool (a fonte da verdade sobre estoque) e só
devolve cotas cuja compra comprovadamente não foi paga, comparando status em
minúsculas para cobrir as duas convenções.

## Ranking com hora de término

`ranking_start_date` / `ranking_end_date` eram salvos e devolvidos ao formulário,
mas **nada comparava com a hora atual**: o ranking nunca encerrava e somava cotas
de qualquer época.

Agora a contagem filtra por `paid_at` dentro da janela, e o bloco na página da
rifa mostra três estados: *não começou* (com a data de abertura), *ao vivo* (com
a data de encerramento) e *encerrado* (resultado congelado, sem mais consultas
ao servidor).

## Colunas inexistentes em `winning_tickets`

`adminAssignWinningTicket` gravava `winner_phone` e `winner_cpf`, colunas que não
existem nessa tabela — a operação falhava inteira com
`Could not find the 'winner_cpf' column`. Telefone e CPF já pertencem ao cadastro
do comprador, então o CPF passou a ser usado para vincular o perfil (`user_id`)
em vez de duplicar dado pessoal.

## Imagens

`<img src={raffle.imageUrl}>` com valor nulo virava `src="null"` e o navegador
pedia `/null` a cada renderização. E `index.html` apontava para um
`/favicon.ico` que não existe no projeto, gerando 404 em toda visita.

Agora `services/imagePlaceholder.ts` fornece `imageSrc()` (placeholder quando não
há imagem) e `handleImageError()` (troca pelo placeholder quando a URL falha ao
carregar). Isso cobre também um banner ativo cujo arquivo já foi removido do
Storage e responde 400.

---

## Configuração do Webhook na Simplify

A Simplify **não assina** os webhooks — a documentação não define header de
autenticação nem assinatura. Por isso o segredo compartilhado viaja na própria
URL, que só a Simplify recebe. O backend anexa `?token=…` sozinho ao criar o
depósito, **então não coloque o token à mão no painel**.

Em `https://simplifybr.com/integracoes/webhooks` → **Adicionar Webhook**:

| Campo | Valor |
|---|---|
| Nome | `Nova Plataforma - Producao` |
| URL | `https://SEU_DOMINIO/api/webhook/simplify?token=SEU_WEBHOOK_SECRET` |
| Depósito gerado | ❌ desmarcado |
| Depósito aprovado | ✅ **marcado** |
| Depósito cancelado | ✅ marcado |

`SEU_WEBHOOK_SECRET` é exatamente o valor da variável `WEBHOOK_SECRET` da
Vercel. "Depósito gerado" fica desmarcado porque a própria resposta do
`POST /pix/deposit` já confirma a criação — a documentação inclusive diz que
esse evento não é enviado para depósitos criados via API.

**Autenticação:** o token na query string. O handler também aceita o header
`x-webhook-secret` e uma assinatura HMAC-SHA256 em `x-signature`, caso a
Simplify passe a oferecer isso.

**Validando que o webhook chega:**

1. `GET https://SEU_DOMINIO/api/health` — `webhookSecret` e `webhookUrl` devem
   estar `true`.
2. Gere um PIX de valor baixo no site e pague.
3. Nos logs da função na Vercel, procure por `[AUDIT_WEBHOOK]`. A sequência
   esperada é `WEBHOOK_RECEIVED` → `DOUBLE_CHECK_*` → `RELEASING_TICKETS` →
   `TICKETS_RELEASED`.
4. `AUTH_FAILED` significa que o token da URL não bate com `WEBHOOK_SECRET`.
5. Nenhuma linha `[AUDIT_WEBHOOK]` significa que a requisição não chegou:
   confira a URL cadastrada e se ela é pública em HTTPS.

A `WEBHOOK_URL` enviada no depósito precisa ser **HTTPS e pública**. A Simplify
recusa a cobrança inteira com *"A URL informada não é válida"* se receber outra
coisa — `http://localhost` incluído. Por isso o backend agora omite a URL quando
ela é inválida (o campo é opcional) e registra um aviso, em vez de derrubar a
geração do PIX.

## Exclusão de rifa e de banner

As duas funcionavam na API; o que impedia em produção era a função serverless
estar caindo inteira. Mas havia dois problemas reais no caminho:

**A exclusão do arquivo acontecia no navegador.** `handleDeleteRaffle` chamava
`storageService.deleteImage()` com a chave anon e **sem `catch`** — bastava essa
etapa falhar para a rifa nunca ser excluída. E só funcionava porque o bucket
estava aberto: um `DELETE` anônimo respondia `Successfully deleted`, ou seja,
qualquer visitante podia apagar as imagens do site.

Agora a remoção do arquivo acontece no servidor, com a service role, dentro de
`deleteRaffle` e `adminDeleteBanner` — e a ETAPA 13 da migração tira `UPDATE` e
`DELETE` do anon no Storage, mantendo `SELECT` e `INSERT` (o upload do admin
continua saindo do navegador).

Verificado listando o bucket: registro e arquivo somem juntos. Conferir pela URL
pública engana — o CDN do Supabase serve a imagem apagada por até uma hora
(`max-age=3600`).

## Ranking manual

Mesma classe de bug das datas de ranking: os compradores cadastrados
manualmente eram salvos e devolvidos ao formulário, mas o bloco na página da
rifa **nunca os usava**. Agora entram na lista junto com os compradores reais,
reordenados por quantidade de cotas.

## Verificando variáveis de ambiente em produção

`GET /api/health` responde com a configuração vista **pela própria função em
execução** — conferir os nomes no painel da Vercel não prova nada, porque um
nome digitado errado, uma variável cadastrada só em Preview ou um deploy antigo
produzem o mesmo painel "correto" com a função quebrada.

A resposta traz `supabaseProjectRef` (qual projeto Supabase está realmente em
uso), `environment` (production/preview), a versão do Node e o comprimento +
prefixo de cada chave — o bastante para diferenciar o Supabase novo do antigo ou
detectar uma credencial trocada, sem expor nenhum segredo.

---

## Painel Admin — validado com sessão real

O login usa Supabase Auth. A conta e o vínculo estão corretos: `admin@admin.com`
existe em `auth.users` (confirmado) e o `profiles.id` correspondente tem
`role = 'admin'` — que é o que `/api/admin/rpc` consulta ao validar o Bearer
token.

Validado com uma sessão real: dashboard, rifas, CRM, vendas, banners,
auditoria, configurações do site, suporte e taxas. E o RBAC nega ações de super
admin para um admin comum (403).

### Progresso das rifas mostrava 100% sem nenhuma venda

`getAllRaffles` e `getRaffleById` contavam **todas** as linhas de
`raffle_ticket_pool` da rifa — que é exatamente `total_numbers` quando o pool
está completo. Resultado: toda rifa com o pool gerado aparecia como
`1000 / 1000`, `100%`, "1000 vendidos", no painel **e na barra de progresso da
Home**, mesmo sem uma única cota paga. Para o visitante, o site inteiro parecia
esgotado.

A contagem passou a filtrar `status = 'PAID'`. Reservadas não entram: ainda não
foram pagas e voltam ao estoque se o PIX expirar, o que faria a barra andar para
trás.

### Rate limit derrubava o painel

`/api/admin/rpc` dividia o limitador dos endpoints públicos: 100 requisições por
15 minutos. Cada tela do painel dispara várias chamadas e algumas fazem polling,
então um administrador trabalhando normalmente recebia **429** — que na
interface aparece como uma operação que "parou de funcionar" sem explicação.
Encontrado durante os testes, batendo no limite de verdade.

Agora existe um limitador próprio para as rotas administrativas (600/15min), com
teto mais alto porque a requisição já passou por autenticação e verificação de
papel. Os limites públicos e de login continuam apertados, e todos respondem em
JSON no 429 (antes o corpo padrão era texto, que o frontend não conseguia ler).

### CRM aparecia vazio

`getUsersCRM` devolvia `full_name` / `totalOrders`, mas a tabela do painel lê
`name`, `purchaseCount`, `pendingCount` e `status`. Todas as linhas apareciam
como "Sem nome", sem contadores, e o filtro por status não encontrava nada.
Agora o retorno bate com a tela e classifica cada lead em VIP / CLIENTE /
QUENTE / FRIO.

### Compras canceladas apareciam como "PENDENTE"

A aba de vendas comparava `p.status === 'PAID'` e caía em "PENDENTE" para
qualquer outro valor — inclusive `cancelled`. O administrador via pagamentos a
cobrar que na verdade já tinham sido cancelados. A comparação passou a tratar as
duas convenções de status ('paid' e 'PAID') e a distinguir CANCELADO.
