import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { supabaseServer } from '../../_lib/supabaseServer';

export async function handleAuth(req: Request, res: Response) {
  // CORS and preflight are handled centrally in api/index.ts against an
  // allow-list, so the per-handler wildcard headers were removed.

  try {
    const action = req.body?.action;
    const { identifier, password, profile, updates } = req.body;

    if (action === 'login') {
      const cleanId = (identifier || '').replace(/\D/g, '');
      const { data: user } = await supabaseServer
        .from('profiles')
        .select('*')
        .or(`cpf.eq.${cleanId},phone.eq.${cleanId}`)
        .single();
        
      if (!user) {
        return res.status(401).json({ success: false, error: 'Nenhum cadastro encontrado com este Telefone ou CPF.' });
      }

      if (password && user.password) {
        // Migration check: if password is not a bcrypt hash, verify plaintext and upgrade
        if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
          if (user.password !== password) {
            return res.status(401).json({ success: false, error: 'Senha incorreta.' });
          }
          // Upgrade to bcrypt
          const hash = await bcrypt.hash(password, 10);
          await supabaseServer.from('profiles').update({ password: hash }).eq('id', user.id);
        } else {
          // Verify bcrypt hash
          const match = await bcrypt.compare(password, user.password);
          if (!match) {
            return res.status(401).json({ success: false, error: 'Senha incorreta.' });
          }
        }
      } else if (password && !user.password) {
         // Profile has no password but user tried to login with one
         return res.status(401).json({ success: false, error: 'Usuário não possui senha cadastrada.' });
      }
      
      // Remove password from returned profile
      delete user.password;
      const camelCaseUser = {
        id: user.id,
        fullName: user.full_name,
        cpf: user.cpf,
        phone: user.phone,
        email: user.email,
        birthDate: user.birth_date,
        cep: user.cep,
        address: user.address,
        number: user.number,
        neighborhood: user.neighborhood,
        city: user.city,
        state: user.state,
        complement: user.complement,
        role: user.role,
        createdAt: user.created_at
      };
      return res.status(200).json({ success: true, profile: camelCaseUser });
    }

    if (action === 'register') {
      const insertData: any = {
        full_name: profile.fullName,
        cpf: profile.cpf?.replace(/\D/g, ''),
        phone: profile.phone?.replace(/\D/g, ''),
        email: profile.email,
        birth_date: profile.birthDate,
        cep: profile.cep,
        address: profile.address,
        number: profile.number,
        neighborhood: profile.neighborhood,
        city: profile.city,
        state: profile.state,
        complement: profile.complement,
        role: 'user'
      };

      if (profile.password) {
        insertData.password = await bcrypt.hash(profile.password, 10);
      }

      const { data, error } = await supabaseServer
        .from('profiles')
        .insert(insertData)
        .select()
        .single();
        
      if (error) {
         return res.status(400).json({ success: false, error: error.message });
      }
      
      delete data.password;
      const camelCaseData = {
        id: data.id,
        fullName: data.full_name,
        cpf: data.cpf,
        phone: data.phone,
        email: data.email,
        birthDate: data.birth_date,
        cep: data.cep,
        address: data.address,
        number: data.number,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        complement: data.complement,
        role: data.role,
        createdAt: data.created_at
      };
      return res.status(200).json({ success: true, profile: camelCaseData });
    }

    if (action === 'update') {
      const { id } = req.body;
      const payload: any = {};
      if (updates.fullName !== undefined) payload.full_name = updates.fullName;
      if (updates.phone !== undefined) payload.phone = updates.phone?.replace(/\D/g, '');
      if (updates.birthDate !== undefined) payload.birth_date = updates.birthDate;
      if (updates.email !== undefined) payload.email = updates.email;
      if (updates.cep !== undefined) payload.cep = updates.cep;
      if (updates.address !== undefined) payload.address = updates.address;
      if (updates.number !== undefined) payload.number = updates.number;
      if (updates.neighborhood !== undefined) payload.neighborhood = updates.neighborhood;
      if (updates.city !== undefined) payload.city = updates.city;
      if (updates.state !== undefined) payload.state = updates.state;
      if (updates.complement !== undefined) payload.complement = updates.complement;

      if (updates.password) {
        payload.password = await bcrypt.hash(updates.password, 10);
      }

      const { error } = await supabaseServer
        .from('profiles')
        .update(payload)
        .eq('id', id);

      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }
      return res.status(200).json({ success: true });
    }

    if (action === 'get_notifications') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ success: false, error: 'ID is required' });

      const { data, error } = await supabaseServer
        .from('winners')
        .select('id, prize, prize_type, ticket_number, raffle_id, raffles(name)')
        .eq('user_id', id)
        .is('notified_at', null)
        .order('created_at', { ascending: true });

      if (error) return res.status(400).json({ success: false, error: error.message });
      return res.status(200).json({ success: true, notifications: data });
    }

    if (action === 'mark_notified') {
      const { id, winnerId } = req.body;
      if (!id || !winnerId) return res.status(400).json({ success: false, error: 'ID and Winner ID are required' });

      // Only update if the winner belongs to the authenticated user ID
      const { data, error } = await supabaseServer
        .from('winners')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', winnerId)
        .eq('user_id', id)
        .select('id')
        .maybeSingle();

      if (error) return res.status(400).json({ success: false, error: error.message });
      if (!data) return res.status(400).json({ success: false, error: 'Unauthorized or not found' });
      
      return res.status(200).json({ success: true });
    }

    if (action === 'migrate_all') {
      // This is a special admin routine to migrate all plaintext passwords at once
      const adminSecret = req.headers['x-admin-secret'];
      const { data: config } = await supabaseServer.from('app_config').select('value').eq('key', 'super_admin_password').single();
      if (!config || config.value !== adminSecret) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const { data: users, error } = await supabaseServer.from('profiles').select('id, password').not('password', 'is', null);
      if (error) return res.status(400).json({ success: false, error: error.message });

      let count = 0;
      for (const user of users) {
        if (user.password && !user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
          const hash = await bcrypt.hash(user.password, 10);
          await supabaseServer.from('profiles').update({ password: hash }).eq('id', user.id);
          count++;
        }
      }
      return res.status(200).json({ success: true, migrated: count });
    }

    return res.status(400).json({ success: false, error: 'Invalid action' });
  } catch (err: any) {
    console.error('[AUTH_API] Error:', err);
    return res.status(400).json({ success: false, error: err?.message || 'Server error' });
  }
}
