/**
 * Imagem exibida quando uma rifa, banner ou ganhador não tem imagem cadastrada.
 *
 * Sem isso, `<img src={raffle.imageUrl} />` com `imageUrl` nulo vira
 * `src="null"` no DOM e o navegador dispara uma requisição para `/null` em toda
 * renderização — 404 no console em produção e um ícone de imagem quebrada na
 * tela.
 *
 * É um data URI para não depender de nenhum arquivo nem de rede.
 */
export const IMAGE_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
      <rect width="400" height="300" fill="#18181b"/>
      <rect x="0.5" y="0.5" width="399" height="299" fill="none" stroke="#27272a"/>
      <g fill="none" stroke="#3f3f46" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="150" y="112" width="100" height="76" rx="8"/>
        <circle cx="176" cy="138" r="9"/>
        <path d="M150 172l30-26 24 20 20-16 26 22"/>
      </g>
    </svg>`
  );

/**
 * Devolve a URL da imagem ou o placeholder. Trata null, undefined, string vazia
 * e as strings literais "null"/"undefined" que aparecem quando um valor nulo é
 * concatenado em algum ponto do caminho.
 */
export function imageSrc(url?: string | null): string {
  if (!url) return IMAGE_PLACEHOLDER;
  const trimmed = String(url).trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return IMAGE_PLACEHOLDER;
  return trimmed;
}

/**
 * Troca a imagem pelo placeholder quando a URL falha ao carregar.
 *
 * Uma URL pode estar salva no banco e o arquivo já ter sido removido do
 * Storage — hoje há um banner ativo nessa situação, cuja imagem responde 400.
 * Sem isto, o visitante vê o ícone de imagem quebrada.
 *
 * A marca em dataset evita laço infinito caso o próprio placeholder falhe.
 */
export function handleImageError(event: { currentTarget: HTMLImageElement }): void {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === 'true') return;
  img.dataset.fallbackApplied = 'true';
  img.src = IMAGE_PLACEHOLDER;
}
