const fs = require('fs');

const handlePhoneChangeReplacement = `  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'phone' | 'phoneConfirm') => {
    let value = e.target.value.replace(/\\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);

    let formatted = value;
    if (value.length > 10) {
      formatted = value.replace(/^(\\d{2})(\\d{5})(\\d{4})$/, '($1) $2-$3');
    } else if (value.length > 6) {
      formatted = value.replace(/^(\\d{2})(\\d{4})(\\d{0,4}).*/, '($1) $2-$3');
    } else if (value.length > 2) {
      formatted = value.replace(/^(\\d{2})(\\d{0,5})/, '($1) $2');
    } else if (value.length > 0) {
      formatted = value.replace(/^(\\d*)/, '($1');
    }
    setFormState(prev => ({ ...prev, [field]: formatted }));
  };`;

const regex = /const\s+handlePhoneChange\s*=\s*\([^)]+\)\s*=>\s*\{[\s\S]*?setFormState\([^;]+;\s*\};/;

['components/MyTickets.tsx', 'components/SuccessView.tsx'].forEach(file => {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(regex, handlePhoneChangeReplacement);
  fs.writeFileSync(file, code);
  console.log('Patched ' + file);
});
