import concurrently from 'concurrently';
import { execSync } from 'child_process';

console.log('========================================================');
console.log('  Starting StudyAI Full-Stack Development Services      ');
console.log('  - Frontend: Vite React App (http://localhost:3000)   ');
console.log('  - Backend:  Express Server (http://localhost:5000)   ');
console.log('========================================================\n');

// 1. Proactively clear any stale/orphaned processes holding ports 3000 or 5000
function freePortIfInUse(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const lines = output.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== String(process.pid) && pid !== '0') {
          console.log(`[Port Guard] Freeing port ${port} held by stale PID ${pid}...`);
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          } catch {}
        }
      }
    }
  } catch {}
}

freePortIfInUse(3000);
freePortIfInUse(5000);

// 2. Start both Frontend & Backend concurrently with colored process prefixes
const { result } = concurrently(
  [
    {
      command: 'npm --prefix server run dev',
      name: 'SERVER',
      prefixColor: 'blue.bold'
    },
    {
      command: 'npx vite',
      name: 'FRONTEND',
      prefixColor: 'magenta.bold'
    }
  ],
  {
    killOthers: ['failure', 'success'],
    restartTries: 0
  }
);

result.then(
  () => process.exit(0),
  () => process.exit(1)
);
