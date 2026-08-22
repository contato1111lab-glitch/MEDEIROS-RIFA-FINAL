const fs = require('fs');
let code = fs.readFileSync('components/CheckoutModal.tsx', 'utf8');

const target = `      const payData = await payRes.json().catch(() => null);

      if (payData && payData.success) {
        const purchaseId = payData.purchaseId;
        setCreatedPurchaseId(purchaseId);`;

const replacement = `      const payData = await payRes.json().catch(() => null);

      if (payData && payData.success) {
        // Auto-authenticate customer after successful profile creation and PIX generation
        if (!customer && login) {
          try {
            await login(cleanCpf, cleanPhone);
          } catch (err) {
            console.error('Silent login after purchase failed:', err);
          }
        }

        const purchaseId = payData.purchaseId;
        setCreatedPurchaseId(purchaseId);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('components/CheckoutModal.tsx', code);
  console.log("Replaced CheckoutModal.tsx");
} else {
  console.log("Could not find target in CheckoutModal.tsx");
}
