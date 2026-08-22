const fs = require('fs');
let code = fs.readFileSync('components/SupportPage.tsx', 'utf8');

const targetImport = `import { raffleService } from '../services/raffleService';`;
const newImport = `import { raffleService } from '../services/raffleService';\nimport { useCustomerAuth } from '../context/CustomerContext';\nimport { useEffect } from 'react';`;

const targetComponent = `export const SupportPage: React.FC = () => {
  const [name, setName] = useState('');`;

const newComponent = `export const SupportPage: React.FC = () => {
  const { customer } = useCustomerAuth();
  const [name, setName] = useState('');
  
  useEffect(() => {
    if (customer) {
      if (customer.fullName && !customer.fullName.startsWith('Cliente ')) {
        setName(customer.fullName);
      }
      if (customer.phone) {
        let p = customer.phone.replace(/\\D/g, "");
        if (p.length === 11) {
          p = p.replace(/^(\\d{2})(\\d{5})(\\d{4})$/, "($1) $2-$3");
        } else if (p.length === 10) {
          p = p.replace(/^(\\d{2})(\\d{4})(\\d{4})$/, "($1) $2-$3");
        }
        setPhone(p);
      }
    }
  }, [customer]);`;

code = code.replace(targetImport, newImport);
code = code.replace(targetComponent, newComponent);
fs.writeFileSync('components/SupportPage.tsx', code);
console.log("Replaced SupportPage");
