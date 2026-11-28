import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { REGISTRY_PROGRAM_ID } from '../packages/solana-client/src/registry.ts';

const registry = 'docs/architecture/DEVNET_DEPLOYMENTS.json';
const artifact = process.env.ENCORE_REGISTRY_BINARY ?? '.local/phase-two/encore.so';
const programKeyFile = process.env.ENCORE_REGISTRY_KEYPAIR ?? '.local/phase-two/program.json';
const payerFile = process.env.ENCORE_REGISTRY_DEPLOYER ?? '.local/phase-one/devnet-payer.json';
const rpc = 'https://api.devnet.solana.com';
const connection = new Connection(rpc, 'finalized');
const loader = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
const id = REGISTRY_PROGRAM_ID;
const binary = existsSync(artifact) ? readFileSync(artifact) : null;
if (await connection.getGenesisHash() !== 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG') throw new Error('Unexpected Solana cluster');
if (process.argv.includes('--deploy')) {
  if (!binary) throw new Error('Build the registry binary before deploying');
  const program = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(programKeyFile, 'utf8'))));
  if (!program.publicKey.equals(id)) throw new Error('Program key does not match the pinned registry address');
  const localCli='.local/toolchain/solana-release/bin/solana';
  const result=spawnSync(existsSync(localCli)?localCli:'solana',['--url',rpc,'--keypair',payerFile,'program','deploy','--program-id',programKeyFile,artifact,'--max-sign-attempts','5'],{stdio:'inherit'});
  if(result.status!==0)throw new Error('Registry deployment failed');
}
const pause = () => new Promise(resolve=>setTimeout(resolve,1500));
for (let attempt=0;attempt<25;attempt++) {
  const program=await connection.getAccountInfo(id);
  if (!program?.executable||!program.owner.equals(loader)||program.data.length<36||program.data.readUInt32LE(0)!==2) {await pause();continue;}
  const programData=new PublicKey(program.data.subarray(4,36));
  const data=await connection.getAccountInfo(programData);
  if (!data?.owner.equals(loader)||data.data.length<45||data.data.readUInt32LE(0)!==3) {await pause();continue;}
  if(binary&&!data.data.subarray(45,45+binary.length).equals(binary)){await pause();continue;}
  const slot=Number(data.data.readBigUInt64LE(4));
  const receipts=await connection.getSignaturesForAddress(programData,{limit:30},'finalized');
  const receipt=receipts.find(item=>item.slot===slot&&!item.err&&item.blockTime);
  if(!receipt?.blockTime){await pause();continue;}
  const entry={cluster:'devnet',programId:id.toBase58(),programData:programData.toBase58(),slot,signature:receipt.signature,blockTime:new Date(receipt.blockTime*1000).toISOString(),upgradeAuthority:data.data[12]===1?new PublicKey(data.data.subarray(13,45)).toBase58():null,binarySha256:binary?createHash('sha256').update(binary).digest('hex'):null};
  const deployments:typeof entry[]=existsSync(registry)?JSON.parse(readFileSync(registry,'utf8')):[];
  if(!deployments.some(item=>item.signature===entry.signature)) {
    const temp=`${registry}.tmp`;
    writeFileSync(temp,JSON.stringify([...deployments,entry],null,2)+'\n');
    renameSync(temp,registry);
  }
  console.log(JSON.stringify(entry,null,2));
  process.exit(0);
}
throw new Error('Finalized deployment could not be verified. Run pnpm chain:record:devnet again before updating the handoff.');
