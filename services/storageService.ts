import { supabase } from './supabaseClient';

const BUCKET_NAME = 'public_images';

export const storageService = {
  async compressImage(file: File, maxSizeMB: number = 2): Promise<File> {
    if (file.size <= maxSizeMB * 1024 * 1024) return file;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const MAX_SIZE = 1920;
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(file);

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.8
          );
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  },

  async uploadImage(file: File, folder: 'raffles' | 'banners' | 'winners'): Promise<string> {
    if (!file.type.startsWith('image/')) {
      throw new Error('O arquivo deve ser uma imagem.');
    }

    const compressedFile = await this.compressImage(file, 2);

    if (compressedFile.size > 2 * 1024 * 1024) {
      throw new Error('A imagem continua maior que 2MB mesmo após compressão.');
    }

    const fileExt = compressedFile.name.split('.').pop();
    const fileName = `${folder}/${crypto.randomUUID()}.${fileExt || 'jpg'}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, compressedFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      throw new Error(`Erro ao fazer upload da imagem: ${error.message}`);
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    return data.publicUrl;
  },

  async deleteImage(url: string): Promise<void> {
    try {
      if (!url.includes(BUCKET_NAME)) return; // Only try to delete if it's from our bucket

      const urlParts = url.split(`${BUCKET_NAME}/`);
      if (urlParts.length !== 2) return;

      const path = urlParts[1].split('?')[0]; // Remove query params if any
      
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([path]);

      if (error) {
        console.error('Error deleting image:', error);
      }
    } catch (e) {
      console.error('Error parsing/deleting image URL:', e);
    }
  }
};
