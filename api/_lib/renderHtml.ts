import fs from 'fs';
import path from 'path';
import { supabaseServer } from './supabaseServer';

let cachedHtml: string | null = null;

export async function getInjectedHtml(isDev = false): Promise<string> {
  try {
    // 1. Lê o HTML original
    if (!cachedHtml || isDev) {
      const prodPath = path.join(process.cwd(), 'dist', 'template.html');
      const devPath = path.join(process.cwd(), 'index.html');
      
      if (isDev && fs.existsSync(devPath)) {
        cachedHtml = fs.readFileSync(devPath, 'utf-8');
      } else if (fs.existsSync(prodPath)) {
        cachedHtml = fs.readFileSync(prodPath, 'utf-8');
      } else if (fs.existsSync(devPath)) {
        cachedHtml = fs.readFileSync(devPath, 'utf-8');
      } else {
        console.error('HTML template not found at paths:', prodPath, devPath);
        return `<!DOCTYPE html><html><head><title>Carregando...</title></head><body><h1>Erro ao carregar template</h1><p>O arquivo HTML estático não foi encontrado no servidor.</p></body></html>`;
      }
    }

    let html = cachedHtml;

    // 2. Busca as configurações no banco de dados super rápido pelo backend
    const { data } = await supabaseServer
      .from('app_config')
      .select('key, value')
      .in('key', ['site_title', 'site_description', 'site_favicon', 'site_og_image']);
    
    const configData: Record<string, string> = {};
    if (data) {
      data.forEach(item => {
        configData[item.key] = item.value;
      });
    }

    // 3. Define the fallback defaults
    const defaultTitle = 'Plataforma de Prêmios';
    const defaultDesc = 'Sua sorte está aqui! Concorra a prêmios incríveis.';
    const defaultFavicon = '/favicon.svg';
    const defaultOgImage = ''; // Vazio por padrão

    const siteTitle = configData['site_title'] || defaultTitle;
    const siteDesc = configData['site_description'] || defaultDesc;
    const siteFavicon = configData['site_favicon'] || defaultFavicon;
    const siteOgImage = configData['site_og_image'] || defaultOgImage;

    // 4. Injeta dinamicamente as variáveis no HTML estático
    html = html.replace(/__META_TITLE__/g, siteTitle);
    html = html.replace(/__META_DESCRIPTION__/g, siteDesc);
    html = html.replace(/__META_FAVICON__/g, siteFavicon);
    html = html.replace(/__META_OG_IMAGE__/g, siteOgImage);

    return html;
  } catch (err) {
    console.error('Error injecting HTML:', err);
    return cachedHtml || 'Error generating page';
  }
}
