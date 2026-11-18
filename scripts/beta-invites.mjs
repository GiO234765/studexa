import { createHash, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const [action, address, ...extra] = process.argv.slice(2)
const email = address?.trim().toLowerCase()
if (!['issue', 'revoke'].includes(action) || !email || email.length > 320
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || extra.length > 0) {
  console.error('Usage: node scripts/beta-invites.mjs <issue|revoke> <tester-email>')
  process.exit(1)
}
if (!process.env.PGHOST || !process.env.PGDATABASE || !process.env.PGUSER) {
  console.error('Set PGHOST, PGDATABASE and PGUSER for the beta database before running this command.')
  process.exit(1)
}

const code = action === 'issue' ? randomBytes(32).toString('base64url') : null
const hash = code ? createHash('sha256').update(code).digest('hex') : ''
const revoke = `
  UPDATE beta_invites SET revoked_at = CURRENT_TIMESTAMP
  WHERE email = :'email' AND redeemed_at IS NULL AND revoked_at IS NULL;
`
const issue = `
  INSERT INTO beta_invites (code_hash, email, expires_at)
  VALUES (:'hash', :'email', CURRENT_TIMESTAMP + INTERVAL '7 days');
`
const result = spawnSync(process.env.BETA_PSQL ?? 'psql', [
  '-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-v', `email=${email}`, '-v', `hash=${hash}`,
], {
  input: `BEGIN;\nSELECT pg_advisory_xact_lock(hashtext(:'email'));\n${revoke}\n${code ? issue : ''}\nCOMMIT;\n`,
  encoding: 'utf8',
  windowsHide: true,
})
if (result.error || result.status !== 0) {
  console.error(result.error?.message ?? result.stderr?.trim() ?? 'The invite operation failed.')
  process.exit(1)
}
console.log(code ?? 'Outstanding invitations were revoked.')
