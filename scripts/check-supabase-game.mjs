import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/utils/supabaseClient.js',import.meta.url),'utf8');
const project='fanffwnhkxpfhttylntw';
if(!source.includes(`https://${project}.supabase.co`)) {
  console.error('Unexpected Supabase project: existing game accounts must remain in the original project.');
  process.exit(1);
}
const key=source.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
if(!key) {
  console.error('Missing public Supabase publishable key.');
  process.exit(1);
}
const url=`https://${project}.supabase.co/auth/v1/health`;
try {
  const response=await fetch(url,{headers:{apikey:key},signal:AbortSignal.timeout(15000)});
  if(!response.ok) {
    console.error(`Supabase Auth unavailable (HTTP ${response.status})`);
    process.exit(1);
  }
  const body=await response.json();
  if(body.status && body.status !== 'ok') {
    console.error('Supabase Auth responded with a non-healthy state.');
    process.exit(1);
  }
  console.log('Supabase Auth is reachable for the existing Game project.');
} catch(error) {
  console.error('Supabase preflight failed:',error.message);
  process.exit(1);
}
