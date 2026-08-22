const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if(url && key) {
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
