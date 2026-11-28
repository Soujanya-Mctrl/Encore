import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync} from 'node:fs';
import {resolve,delimiter} from 'node:path';

const tools=resolve(process.env.ENCORE_PLATFORM_TOOLS??'.local/toolchain/platform-tools-v1.54');
const cargo=resolve(tools,'rust/bin/cargo');
const objcopy=resolve(tools,'llvm/bin/llvm-objcopy');
const build=resolve('.local/sbpf-target');
const binary=resolve(process.env.ENCORE_REGISTRY_BINARY??'.local/phase-two/encore.so');
if(!existsSync(cargo)||!existsSync(objcopy))throw new Error('Configure Anza platform-tools v1.54 with ENCORE_PLATFORM_TOOLS');
function run(command:string,args:string[]){const result=spawnSync(command,args,{stdio:'inherit',env:{...process.env,PATH:[resolve(tools,'rust/bin'),resolve(tools,'llvm/bin'),process.env.PATH].join(delimiter),CARGO_TARGET_DIR:build}});if(result.status!==0)throw new Error(`Registry build failed: ${command}`)}
run(cargo,['build','--locked','--release','--target','sbpf-solana-solana','--manifest-path','programs/encore/Cargo.toml']);
mkdirSync(resolve(binary,'..'),{recursive:true});
run(objcopy,['--strip-all',resolve(build,'sbpf-solana-solana/release/encore.so'),binary]);
console.log(`Registry binary: ${binary}`);
