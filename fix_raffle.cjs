const fs = require('fs');
let code = fs.readFileSync('api/_lib/raffleService.ts', 'utf8');

const target = `role: prof.role,
          createdAt: prof.created_at
        };
      }
    }

    return {`;

const replacement = `role: prof.role,
          createdAt: prof.created_at
        };
        if (hasName && dbPhone.length >= 10) {
          registrationComplete = true;
        }
      }
    }

    return {`;

code = code.replace(target, replacement);
fs.writeFileSync('api/_lib/raffleService.ts', code);
