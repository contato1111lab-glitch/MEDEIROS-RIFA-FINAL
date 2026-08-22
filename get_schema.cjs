const fs = require("fs");
const envFile = fs.readFileSync(".env", "utf8");
const urlMatch = envFile.match(/SUPABASE_URL=([^ \n]+)/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=([^ \n]+)/);
if(urlMatch && keyMatch) {
  const url = urlMatch[1].replace(/['"]/g, "");
  const key = keyMatch[1].replace(/['"]/g, "");
  fetch(`${url}/rest/v1/?apikey=${key}`)
    .then(res => res.json())
    .then(data => {
      if(data && data.definitions && data.definitions.purchases) {
        console.log("=== PURCHASES TABLE ===");
        console.log(JSON.stringify(data.definitions.purchases.properties, null, 2));
      } else {
        console.log("purchases not found");
      }
    })
    .catch(console.error);
}
