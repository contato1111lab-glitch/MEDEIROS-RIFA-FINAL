const fs = require('fs');
let code = fs.readFileSync('api/_handlers/payments/create.ts', 'utf8');

const target = `    // 1. Setup User Profile First
    const cleanCpf = payer.cpf.replace(/\\D/g, '');
    let userId = 'guest';

    if (cleanCpf) {
      // Find or create profile
      const { data: existingUser } = await supabase.from('profiles').select('id').eq('cpf', cleanCpf).maybeSingle();
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const { data: newUser, error: uErr } = await supabase.from('profiles').insert({
          full_name: payer.name,
          cpf: cleanCpf,
          phone: payer.phone?.replace(/\\D/g, ''),
          role: 'user'
        }).select('id').single();
        if (newUser) userId = newUser.id;
      }
    }`;

const replacement = `    // 1. Setup User Profile First
    const cleanCpf = payer.cpf.replace(/\\D/g, '');
    let userId = 'guest';

    if (cleanCpf) {
      // Find or create profile
      const { data: existingUser } = await supabase.from('profiles').select('id').eq('cpf', cleanCpf).maybeSingle();
      if (existingUser) {
        userId = existingUser.id;
      } else {
        if (!payer.name || payer.name.trim() === '') {
          return res.status(400).json({ success: false, error: 'Nome completo é obrigatório.' });
        }
        if (!payer.phone || payer.phone.replace(/\\D/g, '').length < 10) {
          return res.status(400).json({ success: false, error: 'Telefone válido é obrigatório.' });
        }

        const { data: newUser, error: uErr } = await supabase.from('profiles').insert({
          full_name: payer.name,
          cpf: cleanCpf,
          phone: payer.phone?.replace(/\\D/g, ''),
          role: 'user'
        }).select('id').single();
        
        if (uErr || !newUser) {
          safeLogAudit('PROFILE_CREATION_FAILED', { ip: reqIp, error: uErr?.message });
          return res.status(400).json({ success: false, error: 'Erro ao criar seu cadastro. Verifique os dados e tente novamente.' });
        }
        userId = newUser.id;
      }
    }`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('api/_handlers/payments/create.ts', code);
  console.log("Replaced create.ts");
} else {
  console.log("Could not find target in create.ts");
}
