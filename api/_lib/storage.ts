import { supabaseServer } from './supabaseServer';

export const BUCKET_NAME = 'public_images';

/**
 * Remove do Storage o arquivo referenciado por uma URL pública.
 *
 * A exclusão acontecia no navegador, com a chave anon, dentro dos handlers do
 * AdminPanel. Isso trazia dois problemas:
 *
 * 1. Só funcionava porque o bucket estava aberto para qualquer um apagar — ou
 *    seja, qualquer visitante podia deletar as imagens do site.
 * 2. Em `handleDeleteRaffle` a chamada não tinha `catch`, então assim que as
 *    políticas do Storage fossem fechadas, a falha ao apagar o arquivo abortaria
 *    a exclusão da rifa inteira, antes mesmo de chamar a API.
 *
 * Fazendo isso no servidor, com a service role, o navegador não precisa de
 * permissão de escrita no Storage e a exclusão do registro nunca depende disso.
 *
 * Nunca lança: perder o arquivo órfão é preferível a impedir a exclusão do
 * registro no banco.
 */
export async function deleteStorageObject(url?: string | null): Promise<boolean> {
  if (!url || typeof url !== 'string') return false;
  if (!url.includes(`/${BUCKET_NAME}/`)) return false;

  try {
    // .../object/public/public_images/<caminho>?query
    const parts = url.split(`/${BUCKET_NAME}/`);
    if (parts.length !== 2) return false;

    const path = decodeURIComponent(parts[1].split('?')[0]);
    if (!path) return false;

    const { error } = await supabaseServer.storage.from(BUCKET_NAME).remove([path]);
    if (error) {
      console.error('[STORAGE] falha ao remover', path, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[STORAGE] falha ao remover objeto:', err);
    return false;
  }
}
