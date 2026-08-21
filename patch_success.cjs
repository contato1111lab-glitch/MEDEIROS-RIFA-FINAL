const fs = require('fs');
let code = fs.readFileSync('components/SuccessView.tsx', 'utf8');

const replacement = `            if (prof) {
              let formattedPhone = '';
              if (prof.phone && !prof.phone.includes('*')) {
                const cleanP = prof.phone.replace(/\\D/g, '');
                if (cleanP.length === 11) {
                  formattedPhone = cleanP.replace(/^(\\d{2})(\\d{5})(\\d{4})$/, '($1) $2-$3');
                } else if (cleanP.length === 10) {
                  formattedPhone = cleanP.replace(/^(\\d{2})(\\d{4})(\\d{4})$/, '($1) $2-$3');
                }
              }

              const safeFullName = prof.fullName && !prof.fullName.includes('*') && !prof.fullName.startsWith('Cliente ') ? prof.fullName : '';
              const safeEmail = prof.email && !prof.email.includes('*') && !prof.email.includes('@example.invalid') ? prof.email : '';

              let formattedCep = prof.cep || '';
              if (formattedCep.includes('*')) formattedCep = '';
              const cleanCepVal = formattedCep.replace(/\\D/g, '');
              if (cleanCepVal.length === 8) {
                formattedCep = cleanCepVal.replace(/^(\\d{5})(\\d{3})$/, '$1-$2');
              }

              let formattedCpf = prof.cpf || '';
              if (formattedCpf.includes('*')) formattedCpf = '';
              const cleanCpfVal = formattedCpf.replace(/\\D/g, '');
              if (cleanCpfVal.length === 11) {
                formattedCpf = cleanCpfVal.replace(/^(\\d{3})(\\d{3})(\\d{3})(\\d{2})$/, '$1.$2.$3-$4');
              }

              setFormState({
                fullName: safeFullName,
                cpf: formattedCpf,
                phone: formattedPhone,
                phoneConfirm: formattedPhone,
                email: safeEmail,
                password: '',
                birthDate: prof.birthDate && !prof.birthDate.includes('*') ? prof.birthDate : '',
                cep: formattedCep,
                address: prof.address && !prof.address.includes('*') ? prof.address : '',
                number: prof.number && !prof.number.includes('*') ? prof.number : '',
                neighborhood: prof.neighborhood && !prof.neighborhood.includes('*') ? prof.neighborhood : '',
                city: prof.city && !prof.city.includes('*') ? prof.city : '',
                state: prof.state && !prof.state.includes('*') ? prof.state : '',
                complement: prof.complement && !prof.complement.includes('*') ? prof.complement : ''
              });
            }`;

const blockRegex = /if\s*\(prof\)\s*\{\s*let\s+formattedPhone[^]*?complement:\s*prof\.complement\s*\|\|\s*''\s*\}\);\s*\}/;
code = code.replace(blockRegex, replacement);

fs.writeFileSync('components/SuccessView.tsx', code);
console.log('done');
