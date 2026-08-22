const fs = require('fs');
let code = fs.readFileSync('components/CheckoutModal.tsx', 'utf8');

code = code.replace("const { customer, refreshCustomer } = useCustomerAuth();", "const { customer, refreshCustomer, login } = useCustomerAuth();");

fs.writeFileSync('components/CheckoutModal.tsx', code);
console.log("Fixed CheckoutModal.tsx useCustomerAuth");
